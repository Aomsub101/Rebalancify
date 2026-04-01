# Sub-Component: RAG Ingest Pipeline

## 1. The Goal

Ingest Markdown and PDF documents into the user's personal vector knowledge base (`knowledge_chunks` table). The pipeline semantic-chunks content, generates embeddings via the user's configured LLM provider, and upserts chunks with proper metadata. This is the core infrastructure that powers the RAG retrieval step in every research call.

---

## 2. The Problem It Solves

Fixed-size chunking (e.g., "every 500 characters") breaks semantic continuity — it can split a coherent paragraph across two chunks, reducing retrieval quality. The pipeline must split at natural semantic boundaries ("similarity drops") to preserve coherent ideas in each chunk.

---

## 3. The Proposed Solution / Underlying Concept

### Pipeline Steps

```
Document (Markdown string or PDF text)
  → 1. Parse / extract raw text
  → 2. Semantic chunking (split at similarity drops, not fixed char count)
  → 3. Embed each chunk via user's LLM provider
  → 4. Upsert into knowledge_chunks (user_id, document_id, chunk_index, content, embedding, metadata)
```

### Semantic Chunking Algorithm

The chunker analyses text for natural breaks — paragraph boundaries, section headers, or drops in semantic similarity between sentences. The result is a list of coherent chunks, each representing a single idea or topic.

### Embedding Provider Routing

Embedding calls are routed based on the user's configured provider:

| Provider | Embedding Model | SDK |
|---|---|---|
| Google AI Studio | `text-embedding-004` | OpenAI SDK + `base_url` override |
| OpenAI | `text-embedding-3-small` | OpenAI SDK (native) |
| Groq | Same as OpenAI (compatible) | OpenAI SDK + `base_url` override |
| DeepSeek | `text-embedding-3-small` (compatible) | OpenAI SDK + `base_url` override |
| Anthropic | Not used for embedding (LLM only) | — |
| OpenRouter | Varies by selected model | OpenAI SDK + `base_url` override |

### Upsert to knowledge_chunks

Each chunk is stored with:
- `user_id` — from auth session
- `document_id` — UUID generated per document
- `chunk_index` — position in document
- `content` — raw text of chunk
- `embedding` — vector (1536 dims for `text-embedding-3-small`)
- `metadata` — JSONB: `{ source, title, document_name }`

### HNSW Index

The `knowledge_chunks.embedding` column has an HNSW index for fast cosine similarity search. Query plan is verified with `EXPLAIN ANALYZE`.

### Server-Side Only

The entire pipeline runs server-side in Next.js API routes. The user's LLM API key is decrypted, used for the embedding call, and never exposed to the browser.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Semantic chunking vs. fixed char | Unit: feed 3-paragraph doc → verify chunks respect paragraph boundaries |
| Correct embedding model per provider | Unit: mock each provider → verify correct model string passed |
| Chunk upsert has correct metadata | Unit: ingest file → query knowledge_chunks → metadata shape correct |
| HNSW index used on retrieval | SQL `EXPLAIN ANALYZE` on cosine similarity query → "HNSW" in plan |
| Key never in browser | `grep` embedding provider URLs in `app/(dashboard)/` → zero results |
| RLS enforced | User A's chunks not visible to User B |
