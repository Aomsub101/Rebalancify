import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { embedText } from '@/lib/ragIngest'
import { callLLM } from '@/lib/llmRouter'

function containsAllocationPercentageRecommendation(text: string): boolean {
  const lower = text.toLowerCase()
  const pctRegex = /\d+\.?\d*\s*%/g
  const allocRegex =
    /\b(allocation|allocate|weight|portfolio|target|position|holdings|exposure|rebalanc)\b/g
  const windowSize = 80

  const pctMatches = Array.from(lower.matchAll(pctRegex))
  if (pctMatches.length === 0) return false

  for (const m of pctMatches) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    const start = Math.max(0, idx - windowSize)
    const end = Math.min(lower.length, idx + m[0].length + windowSize)
    const windowText = lower.slice(start, end)
    if (allocRegex.test(windowText)) return true
    allocRegex.lastIndex = 0
  }

  // Also catch keyword-first phrasing like "target weight ... 25%"
  const allocMatches = Array.from(lower.matchAll(allocRegex))
  for (const m of allocMatches) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    const start = Math.max(0, idx - windowSize)
    const end = Math.min(lower.length, idx + m[0].length + windowSize)
    const windowText = lower.slice(start, end)
    if (pctRegex.test(windowText)) return true
    pctRegex.lastIndex = 0
  }

  return false
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const supabase = await createClient()

  // Optional body: { refresh?: boolean }
  let refresh = false
  try {
    const body = (await req.json()) as { refresh?: unknown }
    refresh = body?.refresh === true
  } catch {
    // Empty/invalid body is fine
  }

  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in' } },
      { status: 401 }
    )
  }

  // 2. Check cache (Acceptance Criterion 1)
  if (!refresh) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cachedSession } = await supabase
      .from('research_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .or(`refreshed_at.is.null,refreshed_at.gt.${twentyFourHoursAgo}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedSession) {
      return NextResponse.json({
        session_id: cachedSession.id,
        ticker: cachedSession.ticker,
        llm_provider: cachedSession.llm_provider,
        llm_model: cachedSession.llm_model,
        cached: true,
        output: cachedSession.output,
        created_at: cachedSession.created_at,
      })
    }
  }

  // 3. Get LLM profile (Acceptance Criterion 7, 10, 11)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('llm_provider, llm_model, llm_key_enc')
    .eq('id', user.id)
    .single()

  if (!profile?.llm_key_enc) {
    return NextResponse.json(
      { error: { code: 'LLM_KEY_MISSING', message: 'No LLM key configured' } },
      { status: 403 }
    )
  }

  let decryptedKey: string
  try {
    decryptedKey = decrypt(profile.llm_key_enc, process.env.ENCRYPTION_KEY!)
  } catch (err) {
    console.error('Failed to decrypt LLM key:', err)
    return NextResponse.json(
      { error: { code: 'DECRYPTION_ERROR', message: 'Failed to decrypt LLM key' } },
      { status: 500 }
    )
  }

  // 4. Resolve asset_id (Optional)
  const { data: asset } = await supabase
    .from('assets')
    .select('id')
    .eq('ticker', ticker)
    .limit(1)
    .single()

  // 5. RAG Retrieval (Acceptance Criterion 2)
  let knowledgeContext = ''
  let sources: string[] = []
  try {
    const queryEmbedding = await embedText(ticker)
    const { data: chunks, error: rpcError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Low threshold for better context
      match_count: 5,
    })

    if (rpcError) throw rpcError
    
    if (chunks) {
      knowledgeContext = chunks.map((c: any) => c.content).join('\n\n')
      sources = Array.from(new Set(chunks.map((c: any) => c.metadata?.title || c.metadata?.document_name).filter(Boolean))) as string[]
    }
  } catch (err) {
    console.error('RAG retrieval failed:', err)
    // Non-fatal, continue with news only
  }

  // 6. News context (Acceptance Criterion 3)
  let newsContext = ''
  try {
    const { data: news } = await supabase
      .from('news_cache')
      .select('headline, summary, source, published_at')
      .contains('tickers', [ticker])
      .order('published_at', { ascending: false })
      .limit(5)

    if (news && news.length > 0) {
      newsContext = news.map(n => 
        `Headline: ${n.headline}\nSummary: ${n.summary}\nSource: ${n.source}\nDate: ${n.published_at}`
      ).join('\n\n')
    }
  } catch (err) {
    console.error('News context fetch failed:', err)
    // Non-fatal
  }

  // 7. LLM Call (Acceptance Criterion 4, 5, 6, 8, 9)
  const systemPrompt = `You are a financial research assistant. You may provide sentiment analysis, risk factors, and narrative summaries based on the provided context. You must never recommend, suggest, or imply a specific portfolio allocation percentage for any asset. If the user's query asks for allocation advice, decline and explain that you provide research only.

You MUST return your response in the following JSON format:
{
  "sentiment": "bullish | neutral | bearish",
  "confidence": 0.0 to 1.0,
  "risk_factors": ["factor 1", "factor 2"],
  "summary": "150-300 word summary",
  "sources": ["source 1", "source 2"]
}`

  const userPrompt = `Research request for ticker: ${ticker}

CONTEXT FROM KNOWLEDGE BASE:
${knowledgeContext || 'No specific financial literature chunks found.'}

RECENT NEWS:
${newsContext || 'No recent news articles found.'}

Provide a structured sentiment analysis for ${ticker}.`

  let llmOutput: any
  try {
    const llmResponse = await callLLM(
      profile.llm_provider!,
      profile.llm_model!,
      decryptedKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    )

    // Handle Anthropic vs OpenAI response shape
    let content: string
    if (profile.llm_provider === 'anthropic') {
      content = (llmResponse as any).content[0].text
    } else {
      content = (llmResponse as any).choices[0].message.content
    }

    // Allocation guard (STORY-032b AC1): reject allocation percentage recommendations
    if (containsAllocationPercentageRecommendation(content)) {
      return NextResponse.json(
        {
          error: {
            code: 'LLM_ALLOCATION_OUTPUT',
            message: 'LLM output contained a specific allocation percentage recommendation',
          },
        },
        { status: 422 }
      )
    }

    // Attempt to parse JSON
    try {
      llmOutput = JSON.parse(content)
      // Merge RAG sources if LLM didn't provide any
      if (!llmOutput.sources || llmOutput.sources.length === 0) {
        llmOutput.sources = sources
      }
    } catch (parseErr) {
      console.error('Failed to parse LLM response as JSON:', content)
      // Fallback or error
      return NextResponse.json(
        { error: { code: 'LLM_PARSE_ERROR', message: 'Failed to parse LLM structured output' } },
        { status: 502 }
      )
    }
  } catch (err: any) {
    console.error('LLM API error:', err)
    return NextResponse.json(
      { error: { code: 'LLM_API_ERROR', message: err.message || 'LLM provider returned an error' } },
      { status: 502 }
    )
  }

  // 8. Store session (Acceptance Criterion 12)
  const { data: newSession, error: insertError } = await supabase
    .from('research_sessions')
    .insert({
      user_id: user.id,
      ticker,
      asset_id: asset?.id || null,
      llm_provider: profile.llm_provider,
      llm_model: profile.llm_model,
      output: llmOutput,
      refreshed_at: refresh ? new Date().toISOString() : null,
      metadata: { source: 'manual_search' } // Default for now
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    console.error('Failed to store research session:', insertError)
    // Still return the output even if storage fails, but log it
  }

  return NextResponse.json({
    session_id: newSession?.id,
    ticker,
    llm_provider: profile.llm_provider,
    llm_model: profile.llm_model,
    cached: false,
    output: llmOutput,
    created_at: newSession?.created_at || new Date().toISOString(),
  })
}
