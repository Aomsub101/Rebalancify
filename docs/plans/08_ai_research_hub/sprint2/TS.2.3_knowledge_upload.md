# TS.2.3 — Knowledge Upload

## Task
Implement POST /api/knowledge/upload for user document uploads (PDF/MD) with corpus size monitoring.

## Target
`app/api/knowledge/upload/route.ts`

## Inputs
- TS.2.2 outputs (RAG ingest pipeline)
- `docs/architecture/components/08_ai_research_hub/09_api_knowledge_upload.md`

## Process
1. Create `app/api/knowledge/upload/route.ts`:
   - Accept PDF or Markdown file upload (multipart form data)
   - Extract text content (PDF: use pdf-parse; MD: read directly)
   - Call `ingestDocument()` from ragPipeline with `source: "upload"`
   - Return: `{ document_id, chunks_created, storage_used_mb }`
2. Corpus size monitoring:
   - If `knowledge_chunks` storage approaches 400 MB (80% of 500 MB budget):
     - Return warning in response: `{ capacity_warning: true }`
     - Settings shows capacity warning banner
3. DELETE /api/knowledge/documents/:id — remove uploaded document's chunks

## Outputs
- `app/api/knowledge/upload/route.ts`
- `app/api/knowledge/documents/[id]/route.ts` (DELETE)

## Verify
- PDF upload → text extracted → chunks created
- MD upload → chunks created
- Capacity warning at 80% threshold
- Delete removes all chunks for document

## Handoff
→ TS.2.4 (Knowledge APIs)
