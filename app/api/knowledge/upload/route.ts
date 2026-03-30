import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkDocument, embedText } from '@/lib/ragIngest'
import { parsePdf } from '@/lib/pdfParser'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  // Validate embedding config
  if (!process.env.EMBEDDING_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: 'EMBEDDING_KEY_MISSING',
          message: 'Embedding API key not configured.',
        },
      },
      { status: 500 },
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'No file provided' } },
        { status: 400 },
      )
    }

    const fileName = file.name
    const isPdf = fileName.toLowerCase().endsWith('.pdf')
    const isMd = fileName.toLowerCase().endsWith('.md')

    if (!isPdf && !isMd) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Only PDF and Markdown files are supported.' } },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    let content: string
    if (isPdf) {
      try {
        content = await parsePdf(buffer)
      } catch (err: unknown) {
        return NextResponse.json(
          { error: { code: 'PDF_PARSE_ERROR', message: 'Failed to parse PDF.' } },
          { status: 422 },
        )
      }
    } else {
      content = buffer.toString('utf-8')
    }

    // Generate a stable document_id based on file name and content hash
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(`upload:${fileName}:${user.id}`).digest('hex')
    const documentId = [
      hash.slice(0, 8),
      hash.slice(8, 12),
      hash.slice(12, 16),
      hash.slice(16, 20),
      hash.slice(20, 32),
    ].join('-')

    const chunks = chunkDocument(content, fileName, 'upload')

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: { code: 'EMPTY_DOCUMENT', message: 'No usable text found in document.' } },
        { status: 422 },
      )
    }

    let chunksInserted = 0
    for (const chunk of chunks) {
      const embedding = await embedText(chunk.content)

      const { error: upsertError } = await supabase.from('knowledge_chunks').upsert(
        {
          user_id: user.id,
          document_id: documentId,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          embedding,
          metadata: chunk.metadata,
        },
        {
          onConflict: 'user_id,document_id,chunk_index',
          ignoreDuplicates: true,
        },
      )

      if (upsertError) {
        console.error('[knowledge/upload] upsert error:', upsertError.code, upsertError.message)
        throw new Error(`Database upsert failed for ${fileName}: ${upsertError.message}`)
      }

      chunksInserted++
    }

    return NextResponse.json({
      success: true,
      document_id: documentId,
      file_name: fileName,
      chunks_inserted: chunksInserted,
    }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[knowledge/upload] failed:', message)
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: 'Failed to process file upload.' } },
      { status: 500 },
    )
  }
}
