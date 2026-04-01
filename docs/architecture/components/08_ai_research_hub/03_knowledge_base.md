# Sub-Component: Knowledge Base

## 1. The Goal

Provide a curated, foundational financial knowledge corpus that grounds every LLM research response in established finance theory. Users also have the ability to upload their own documents to create a personal, private knowledge base.

---

## 2. The Problem It Solves

LLM responses about financial assets can be generic, hallucinated, or lack grounding in established finance theory. By pre-loading curated financial literature and giving users the ability to upload their own research, responses are anchored in real content — reducing hallucination risk and increasing relevance to each user's personal context.

---

## 3. The Proposed Solution / Underlying Concept

### Default Knowledge Files

The `/knowledge/` directory at the repo root contains 10 Markdown files:

```
/knowledge/
├── 01-modern-portfolio-theory.md
├── 02-asset-allocation-principles.md
├── 03-rebalancing-strategies.md
├── 04-systematic-risk-factors.md
├── 05-dcf-analysis-fundamentals.md
├── 06-fixed-income-basics.md
├── 07-crypto-asset-characteristics.md
├── 08-emerging-markets-risk.md
├── 09-behavioral-finance-biases.md
└── 10-portfolio-concentration-risk.md
```

### Trigger: First Use or Manual

Default documents are ingested:
1. On first Research Hub use (first call to `POST /api/research/:ticker`)
2. Manually via a "Rebuild knowledge base" button in Settings

### User Uploads

Users can upload PDF or Markdown files via `POST /api/knowledge/upload`. These are processed through the same ingest pipeline with `source: "upload"`. Uploaded documents can be listed and deleted via `DELETE /api/knowledge/documents/:id`.

### Metadata Shape

Each chunk stored in `knowledge_chunks` carries metadata:
```typescript
{
  source: "default" | "upload",
  title: string,          // derived from document name
  document_name: string   // original filename
}
```

### Corpus Size Monitoring

`GET /api/knowledge/corpus-size` returns the current storage size. If storage exceeds 400 MB (80% of a 500 MB budget), a warning is shown in Settings: "Your knowledge base is near capacity (80%). Consider removing uploaded documents."

### RLS

All `knowledge_chunks` rows are isolated per user via Row Level Security. User A's chunks are never visible to User B.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| 10 default files in /knowledge | `ls /knowledge/*.md` → 10 files |
| First research use triggers ingest | Create new user → first research call → verify chunks inserted |
| "Rebuild" button triggers ingest | Settings → "Rebuild" → verify re-ingest |
| User upload processed with source: "upload" | Upload PDF → query `knowledge_chunks` → metadata.source === "upload" |
| Corpus size warning at 80% | Mock `pg_total_relation_size` near 400MB → warning visible |
| RLS isolation | User A uploads → User B queries → zero chunks visible |
