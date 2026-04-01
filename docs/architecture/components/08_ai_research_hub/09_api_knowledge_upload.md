# Sub-Component: API — Knowledge Upload

## 1. The Goal

Allow users to upload their own PDF or Markdown research documents to expand their personal knowledge base. Uploaded documents are processed through the same RAG ingest pipeline as the default corpus, tagged with `source: "upload"`, and can be listed and deleted by the user.

---

## 2. The Problem It Solves

Users may have their own research — proprietary analysis, broker statements, thesis documents — that they want the LLM to consider when generating research. Without upload capability, they are limited to the 10 default files. Upload gives them a personal, private RAG corpus.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint: `POST /api/knowledge/upload`

**Request:** `multipart/form-data` with a `file` field (PDF or Markdown)

**Constraints:**
- Max file size: ~5 MB (configurable)
- Allowed MIME types: `application/pdf`, `text/markdown`, `text/plain`

**Processing:**
```
1. Parse PDF or Markdown file
2. Run through lib/ragIngest.ts (semantic chunking + embedding)
3. Upsert into knowledge_chunks with metadata.source = "upload"
4. Return { document_id, chunks_ingested: number }
```

### Endpoint: `GET /api/knowledge/documents`

Returns a list of user's uploaded documents (those with `metadata.source = "upload"`):
```typescript
{ id: string, document_name: string, title: string, chunk_count: number, uploaded_at: string }
```

### Endpoint: `DELETE /api/knowledge/documents/:id`

Deletes all chunks belonging to the specified document:
```
DELETE FROM knowledge_chunks WHERE document_id = $1 AND user_id = $2
```
Returns `{ deleted_chunks: number }`.

### Corpus Size Warning

After upload, `GET /api/knowledge/corpus-size` is called. If the total size exceeds 400 MB, a warning is shown in Settings.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| PDF upload processed | Upload small PDF → verify chunks inserted with `source: "upload"` |
| Markdown upload processed | Upload `.md` file → same verification |
| Wrong MIME type rejected | Upload `.exe` → HTTP 415 Unsupported Media Type |
| Document listed after upload | Upload → GET /documents → document appears |
| DELETE removes all document chunks | Upload → DELETE /documents/:id → zero chunks for that doc_id |
| Size warning shown at 80% | Upload enough files to exceed threshold → Settings warning appears |
