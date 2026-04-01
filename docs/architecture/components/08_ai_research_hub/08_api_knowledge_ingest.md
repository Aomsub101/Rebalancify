# Sub-Component: API — Knowledge Ingest

## 1. The Goal

Ingest the 10 default knowledge base Markdown files into the user's personal `knowledge_chunks` table. This is triggered on first Research Hub use or manually via a "Rebuild knowledge base" button in Settings. It must handle re-ingestion (idempotently replacing existing default chunks for the user) without duplicating content.

---

## 2. The Problem It Solves

The default corpus needs to be loaded into each user's vector database on first use. If the same user triggers ingest twice (e.g., clicking "Rebuild"), the system must not duplicate chunks — it should replace the existing default chunks.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint: `POST /api/knowledge/ingest`

**Triggered by:**
1. First `POST /api/research/:ticker` call when user's `knowledge_chunks` is empty
2. Manual "Rebuild knowledge base" button in Settings

### Ingestion Process

```
1. Read all .md files from /knowledge/
2. For each file:
   a. Parse content
   b. Semantic chunking (via lib/ragIngest.ts)
   c. For each chunk:
      - Generate embedding via user's LLM provider
      - Upsert into knowledge_chunks
3. Return { chunks_ingested: number }
```

### Idempotency

Before ingesting default files, existing chunks with `metadata.source = 'default'` are deleted for the user. Then new chunks are inserted. This ensures rebuilds do not accumulate duplicate default content.

### Re-ingestion from Settings

The Settings page shows a "Rebuild knowledge base" button that calls `POST /api/knowledge/ingest`. A spinner is shown during the call. On success, a toast confirms: "Knowledge base rebuilt — N chunks ingested."

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| 10 files ingested on first use | Unit: new user calls ingest → `SELECT COUNT(*)` from knowledge_chunks → 10 files × N chunks |
| Rebuild deletes old default chunks first | Unit: call ingest twice → count should not double |
| Rebuild then re-ingests new chunks | Unit: call ingest twice → assert same total chunk count both times |
| Toast confirmation on rebuild success | Manual: click Rebuild → toast with "Knowledge base rebuilt" |
| Key never in browser | `grep` embedding provider URLs in `app/(dashboard)/` → zero results |
