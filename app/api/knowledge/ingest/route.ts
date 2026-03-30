/**
 * POST /api/knowledge/ingest
 *
 * Reads all default knowledge files from /knowledge/, runs the RAG ingest pipeline
 * (chunk → embed → upsert to knowledge_chunks), and returns a summary.
 *
 * Triggered on first Research Hub use or by the "Rebuild knowledge base" button in Settings.
 *
 * SECURITY (CLAUDE.md Rule 4 & F3-R2):
 *   - EMBEDDING_API_KEY is a server-side env var; never returned in responses or logged.
 *   - All embedding calls are made server-side in this route — never from the browser.
 *
 * RLS (AC9): knowledge_chunks rows are scoped to user_id = auth.uid()
 *   via the knowledge_chunks_owner RLS policy (migration 14).
 */
import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { chunkDocument, embedText } from '@/lib/ragIngest'

interface IngestResult {
  files_processed: number
  chunks_inserted: number
  skipped_files: string[]
}

export async function POST() {
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
          message: 'Embedding API key not configured. Set EMBEDDING_API_KEY in environment.',
        },
      },
      { status: 500 },
    )
  }

  // Locate the /knowledge directory at the repo root
  const knowledgeDir = path.join(process.cwd(), 'knowledge')

  let files: string[]
  try {
    const entries = await readdir(knowledgeDir)
    files = entries.filter((f) => f.endsWith('.md')).sort()
  } catch {
    return NextResponse.json(
      { error: { code: 'KNOWLEDGE_DIR_MISSING', message: 'Knowledge directory not found.' } },
      { status: 500 },
    )
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_KNOWLEDGE_FILES', message: 'No .md files found in /knowledge.' } },
      { status: 500 },
    )
  }

  const result: IngestResult = {
    files_processed: 0,
    chunks_inserted: 0,
    skipped_files: [],
  }

  // Generate a stable document_id per file — deterministic UUID v5 (sha-based) is ideal,
  // but since Node's crypto module does not expose UUID v5 directly, we use a deterministic
  // hex digest truncated to UUID format. This ensures re-ingesting the same file reuses the
  // same document_id, allowing ON CONFLICT DO NOTHING to act as an idempotent upsert.
  async function stableDocumentId(fileName: string): Promise<string> {
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(`default:${fileName}`).digest('hex')
    // Format as UUID: 8-4-4-4-12
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      hash.slice(12, 16),
      hash.slice(16, 20),
      hash.slice(20, 32),
    ].join('-')
  }

  for (const fileName of files) {
    try {
      const filePath = path.join(knowledgeDir, fileName)
      const content = await readFile(filePath, 'utf-8')
      const documentId = await stableDocumentId(fileName)

      // Semantic chunking
      const chunks = chunkDocument(content, fileName, 'default')
      if (chunks.length === 0) {
        result.skipped_files.push(fileName)
        continue
      }

      // Embed + upsert each chunk
      for (const chunk of chunks) {
        const embedding = await embedText(chunk.content)

        // ON CONFLICT DO NOTHING makes this idempotent:
        // re-running ingest for the same file does not duplicate rows.
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
          // Log the error code but not the content (may contain sensitive research text)
          console.error('[knowledge/ingest] upsert error:', upsertError.code, upsertError.message)
          throw new Error(`Database upsert failed for ${fileName}: ${upsertError.message}`)
        }

        result.chunks_inserted++
      }

      result.files_processed++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[knowledge/ingest] failed on ${fileName}:`, message)
      result.skipped_files.push(fileName)
    }
  }

  return NextResponse.json(result)
}
