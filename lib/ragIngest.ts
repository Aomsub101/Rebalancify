/**
 * lib/ragIngest.ts
 * RAG document ingest utilities.
 *
 * Provides:
 *   chunkDocument()  — splits Markdown on H2 boundaries
 *   padEmbedding()   — zero-pads a vector to a target dimension
 *   embedText()      — calls the configured embedding provider (server-side only)
 *   embedTexts()     — batches multiple texts through embedText()
 *
 * SECURITY (CLAUDE.md Rule 4):
 *   embedText() uses EMBEDDING_API_KEY — server-side env var only.
 *   Never call embedText() from client components.
 *   Never log EMBEDDING_API_KEY.
 *
 * Embedding provider (F3-R2):
 *   EMBEDDING_PROVIDER=google  → text-embedding-004 (768-dim) → padded to 1536
 *   EMBEDDING_PROVIDER=openai  → text-embedding-3-small (1536-dim native)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkMetadata {
  source: 'default' | 'upload'
  title: string
  document_name: string
}

export interface DocumentChunk {
  chunk_index: number
  content: string
  metadata: ChunkMetadata
}

// ---------------------------------------------------------------------------
// chunkDocument
// ---------------------------------------------------------------------------

/**
 * Splits a Markdown document into chunks at H2 headings (hard boundaries).
 * The ## Sources section is excluded from the output — it is referenced metadata,
 * not retrieval content.
 *
 * @param content    Raw Markdown file content.
 * @param fileName   The file's base name (e.g. "01-mpt.md") stored in metadata.
 * @param source     "default" for built-in knowledge files, "upload" for user uploads.
 */
export function chunkDocument(
  content: string,
  fileName: string,
  source: 'default' | 'upload' = 'default',
): DocumentChunk[] {
  // Extract H1 title (first line of the form "# Some Title")
  const titleMatch = content.match(/^#\s+(.+)/m)
  const title = titleMatch ? titleMatch[1].trim() : fileName

  const metadata: ChunkMetadata = { source, title, document_name: fileName }

  // Split the content on H2 headings
  // Each element after split: the text between this H2 and the next H2
  const parts = content.split(/^##\s+/m)

  const chunks: DocumentChunk[] = []

  for (const part of parts) {
    if (!part.trim()) continue

    // First line of the part is the heading text (after the split removed "## ")
    const lines = part.split('\n')
    const headingText = lines[0].trim()

    // Skip the ## Sources section — it is reference-only
    if (headingText.toLowerCase() === 'sources') continue

    // Body is everything after the heading line
    const body = lines.slice(1).join('\n').trim()
    if (!body) continue

    // Re-assemble the chunk content with its heading
    const chunkContent = `## ${headingText}\n\n${body}`

    chunks.push({
      chunk_index: chunks.length,
      content: chunkContent,
      metadata,
    })
  }

  // If no H2 sections produced chunks, treat the whole document as one chunk
  if (chunks.length === 0) {
    const body = content.trim()
    if (body) {
      chunks.push({ chunk_index: 0, content: body, metadata })
    }
  }

  return chunks
}

// ---------------------------------------------------------------------------
// padEmbedding
// ---------------------------------------------------------------------------

/**
 * Pads a numeric embedding vector to targetDim by appending zeros.
 * If vec.length === targetDim, returns a shallow copy unchanged.
 * Does not mutate the input array.
 *
 * Use case: Google text-embedding-004 returns 768 dims; pad to 1536 for
 * compatibility with the vector(1536) column (F3-R2).
 */
export function padEmbedding(vec: number[], targetDim: number): number[] {
  if (vec.length >= targetDim) return [...vec]
  const padding = new Array<number>(targetDim - vec.length).fill(0)
  return [...vec, ...padding]
}

// ---------------------------------------------------------------------------
// embedText — server-side only
// ---------------------------------------------------------------------------

type EmbeddingProvider = 'google' | 'openai'

/**
 * Embeds a single text string using the configured embedding provider.
 * Reads EMBEDDING_PROVIDER and EMBEDDING_API_KEY from environment (server-side).
 *
 * Returns a 1536-dimension vector (padded if Google, native if OpenAI).
 * Throws if the provider is misconfigured or the API returns an error.
 */
export async function embedText(text: string): Promise<number[]> {
  const provider = (process.env.EMBEDDING_PROVIDER ?? 'google') as EmbeddingProvider
  const apiKey = process.env.EMBEDDING_API_KEY

  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY environment variable is not set')
  }

  if (provider === 'google') {
    return embedWithGoogle(text, apiKey)
  }
  if (provider === 'openai') {
    return embedWithOpenAI(text, apiKey)
  }

  throw new Error(`Unknown EMBEDDING_PROVIDER: ${provider}. Supported: google, openai`)
}

/**
 * Embeds multiple texts. Calls embedText() sequentially to respect
 * provider rate limits on the free tier.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const text of texts) {
    results.push(await embedText(text))
  }
  return results
}

// ---------------------------------------------------------------------------
// Provider-specific embedding implementations
// ---------------------------------------------------------------------------

async function embedWithGoogle(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google embedding API error ${res.status}: ${body}`)
  }

  const data = await res.json() as { embedding?: { values?: number[] } }
  const values = data?.embedding?.values
  if (!Array.isArray(values)) {
    throw new Error('Google embedding API returned unexpected shape')
  }

  // text-embedding-004 is 768-dim; pad to 1536 for vector(1536) column compatibility
  return padEmbedding(values, 1536)
}

async function embedWithOpenAI(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI embedding API error ${res.status}: ${body}`)
  }

  const data = await res.json() as { data?: Array<{ embedding?: number[] }> }
  const values = data?.data?.[0]?.embedding
  if (!Array.isArray(values)) {
    throw new Error('OpenAI embedding API returned unexpected shape')
  }

  // text-embedding-3-small is natively 1536-dim
  return values
}
