# Sub-Component: API — Research Ticker

## 1. The Goal

Serve the full research pipeline for a given ticker: cache check, RAG retrieval, news context fetch, LLM inference with regulatory constraint, allocation guard, and response storage. This is the core endpoint of the AI Research Hub.

---

## 2. The Problem It Solves

The research pipeline orchestrates multiple services (vector DB, news cache, LLM) with complex caching, error handling, and security semantics. This endpoint must handle all of it in a single, coherent flow — returning structured JSON to the client and never exposing keys.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint: `POST /api/research/:ticker`

```
Request body (optional):
  { "refresh": true }   // forces bypass of 24h cache
```

### Pipeline Steps

**Step 1 — Cache check**
```
SELECT * FROM research_sessions
WHERE user_id = $1 AND ticker = $2
AND (refreshed_at IS NULL OR refreshed_at < NOW() - INTERVAL '24 hours')
```
- Cache hit → return cached `research_sessions.output` immediately (no LLM call)
- Cache miss → proceed to Step 2
- `{ refresh: true }` → bypass cache, proceed to Step 2

**Step 2 — RAG retrieval**
```
1. Generate query embedding: "{$ticker} financial analysis"
2. Cosine similarity search on knowledge_chunks (top 5 chunks)
```

**Step 3 — News context**
```
SELECT * FROM news_cache
WHERE tickers @> ARRAY[$ticker]
ORDER BY published_at DESC
LIMIT 5
```

**Step 4 — LLM inference**
```
System prompt includes:
"You must never recommend, suggest, or imply a specific portfolio allocation
percentage for any asset."

User prompt includes: top 5 knowledge chunks + up to 5 news articles

Structured output schema: { sentiment, confidence, risk_factors, summary, sources }
```

**Step 5 — Allocation guard**
→ Regex scan of raw LLM output
→ If allocation language detected: HTTP 422 `LLM_ALLOCATION_OUTPUT` (no row inserted)

**Step 6 — Store and respond**
```
INSERT INTO research_sessions (user_id, ticker, output)
VALUES ($1, $2, $3)
RETURNING output
```

### Error Responses

| Condition | HTTP | Code | Message |
|---|---|---|---|
| No LLM key configured | 403 | `LLM_KEY_MISSING` | "No LLM API key configured" |
| LLM provider error | 502 | `LLM_API_ERROR` | Provider's error message |
| Allocation detected | 422 | `LLM_ALLOCATION_OUTPUT` | "The model output contained an allocation recommendation" |
| RAG/DB error | 500 | — | Generic error (details logged server-side) |

### Endpoint: `GET /api/research/:ticker`

Reads the most recent `research_sessions` row for `(user_id, ticker)` and returns the structured output.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Cache hit < 24h → no LLM call | Unit: call twice in row → verify LLM not called second time |
| `{ refresh: true }` → bypasses cache | Unit: send `{ refresh: true }` → LLM called, new row inserted |
| Top 5 chunks returned | Unit: mock RAG → assert `chunks.length === 5` |
| 5 news articles fetched | Unit: mock news cache → assert `articles.length === 5` |
| Allocation guard fires | Unit: inject "Allocate 25%..." in mock LLM output → HTTP 422 |
| LLM_KEY_MISSING on missing key | Unit: mock no key → HTTP 403 |
| LLM_API_ERROR on provider failure | Unit: mock provider 500 → HTTP 502 |
| Key never in browser | `grep` provider domains in `app/(dashboard)/` → zero results |
| RLS: user B cannot read user A's sessions | RLS isolation test |
