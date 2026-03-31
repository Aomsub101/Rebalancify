# Component 8 — AI Research Hub

## 1. The Goal

Provide a v2.0 RAG-powered qualitative research layer that lets users query any ticker and receive a structured sentiment analysis with risk factors, sourced from both a personal knowledge base (curated default documents + user uploads) and recent news. The LLM is called through AI Gateway (OIDC auth, six supported providers), never exposing the user's API key to the browser. The system rejects any LLM output that recommends specific allocation percentages.

---

## 2. The Problem It Solves

Investors researching an asset need qualitative context — not just price charts — to make informed decisions. They benefit from: (a) curated financial literature (MPT, risk factors, DCF analysis) that grounds responses in established finance theory, (b) recent news about the specific asset, and (c) a structured output format that is easy to scan. But: LLM API keys must stay server-side, the system must never tell the user what percentage to allocate (legal/ethical risk), and the knowledge base must be personal to each user.

---

## 3. The Proposed Solution / Underlying Concept

### LLM Key Storage (STORY-030)

Six providers are supported: Google AI Studio (free tier), Groq (free tier), DeepSeek (free tier), OpenAI, Anthropic, OpenRouter. The user's chosen key is stored encrypted in `user_profiles.llm_key_enc` using the AES-256-GCM pattern from Component 3. `GET /api/profile` returns `llm_connected: bool`, `llm_provider`, and `llm_model` — never the ciphertext.

Settings includes a `LLMSection` with:
- `ProviderSelector` dropdown — free tiers labelled `(Free)`
- `ModelSelector` — pre-filled with the recommended free model per provider
- `LLMKeyInput` — `type="password"` with show/hide toggle
- `FreeTierNote`: "Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq), and DeepSeek V3 are free."

A validation ping is made to the provider on save. If invalid, an inline error is shown.

### Default Knowledge Base (STORY-031)

The `/knowledge` directory at the repo root contains 10+ curated Markdown files covering foundational finance topics:
`01-modern-portfolio-theory.md`, `02-asset-allocation-principles.md`, `03-rebalancing-strategies.md`, `04-systematic-risk-factors.md`, `05-dcf-analysis-fundamentals.md`, `06-fixed-income-basics.md`, `07-crypto-asset-characteristics.md`, `08-emerging-markets-risk.md`, `09-behavioral-finance-biases.md`, `10-portfolio-concentration-risk.md`

On first Research Hub use (or via a "Rebuild knowledge base" button in Settings), these files are ingested:

**Ingest pipeline:**
1. Read file content
2. Semantic chunking — split at similarity drops (not fixed character counts)
3. Embed using the user's configured LLM provider's embedding endpoint (Google: `text-embedding-004`; OpenAI: `text-embedding-3-small`)
4. Upsert into `knowledge_chunks` with: `user_id`, `document_id`, `chunk_index`, `content`, `embedding` (vector), `metadata` (`{ source: "default", title, document_name }`)

### User Document Upload (STORY-031b)

Users can upload PDF or Markdown files via `POST /api/knowledge/upload`. These are processed through the same ingest pipeline with `source: "upload"`. Uploaded documents can also be deleted to manage the corpus.

**Corpus size monitoring**: If `knowledge_chunks` storage approaches 400 MB (80% of a 500 MB budget), Settings shows a capacity warning.

**HNSW index**: `knowledge_chunks` has an HNSW index on the `embedding` column for fast cosine similarity queries. Verified via `EXPLAIN ANALYZE`.

### Research Endpoint (STORY-032, STORY-032b)

`POST /api/research/:ticker` — the core research pipeline:

```
1. Cache check
   → If a research_sessions row exists for (user_id, ticker)
     AND refreshed_at IS NULL OR refreshed_at < 24 hours ago:
     return cached output (no LLM call)

2. RAG retrieval
   → Generate query embedding from ticker name + "financial analysis"
   → Cosine similarity search against knowledge_chunks (top 5 chunks)
   → Fetch up to 5 recent news articles from news_cache where ticker is mentioned

3. LLM inference
   → System prompt includes regulatory constraint: "You must never recommend,
     suggest, or imply a specific portfolio allocation percentage for any asset."
   → Augment with: top 5 knowledge chunks, up to 5 news articles
   → Structured output schema: { sentiment, confidence, risk_factors, summary, sources }

4. Allocation guard (STORY-032b)
   → Regex scan of LLM raw output for allocation language near percentages
     (\d+\.?\d*\s*% near "allocate", "weight", "hold", "buy", "sell", etc.)
   → If detected: HTTP 422, code: "LLM_ALLOCATION_OUTPUT"

5. Store & respond
   → Insert new research_sessions row with structured output
   → Return structured response to client
```

**Forced refresh**: If the user requests a refresh, a new `research_sessions` row is inserted with `refreshed_at` populated. The old row is never updated.

### Provider Routing (STORY-032)

```typescript
// lib/llmRouter.ts
// All providers routed through OpenAI-compatible SDK with base_url override
// except Anthropic which uses its own SDK
// google, groq, deepseek, openrouter → OpenAI SDK + provider base_url
// openai → OpenAI SDK (default base_url)
// anthropic → @anthropic-ai/sdk
```

### Research Hub UI (STORY-033)

The Research page at `/research/[ticker]` renders:

- **`DisclaimerBanner`** — always visible, non-collapsible: "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions." (AC: no close/dismiss button in DOM)
- **`LLMKeyGate`** — if `llm_connected = false`: "To use the Research Hub, add your LLM API key in Settings." No research UI rendered behind this gate.
- **`ResearchHeader`** — ticker, company name, last refreshed timestamp
- **`RefreshButton`** — triggers forced refresh (bypasses cache); shows spinner during in-flight call
- **`SentimentCard`** — coloured badge (bullish=green, neutral=muted, bearish=red) + confidence bar (0.0–1.0); both colour and text label present
- **`RiskFactorsCard`** — bulleted list, 2–8 items; if < 2 returned: `ErrorBanner`
- **`NarrativeSummaryCard`** — 150–300 word summary, expandable if truncated; sources list collapsible

**`AiInsightTag`** on `PeerCard` (STORY-033): When `llm_connected = true` and a `research_sessions` row exists for the peer ticker, `PeerCard` on the Discover page shows a brief (≤12 word) AI insight tag. No additional LLM call is triggered just to render the tag — it reads from the existing cache.

### Research Triggers

Users reach the Research page via:
1. Navigating directly to `/research/[ticker]`
2. Clicking a holding's ticker in the silo detail page (`HoldingRow` ticker is a link)
3. Clicking a ticker on the Discover page

### "This is not financial advice" Disclaimer

Rule 14 (CLAUDE.md): The disclaimer appears in the footer of every page AND as a persistent label on all AI Research Hub outputs. The `DisclaimerBanner` on the Research page satisfies this requirement for AI outputs; the page footer satisfies the per-page requirement.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Cache hit < 24h — no LLM call | Unit: call `POST /api/research/:ticker` twice within 24h → second call returns cached, LLM not called |
| Cache forced refresh | Unit: `{ refresh: true }` → new row inserted with `refreshed_at` populated, old row untouched |
| RAG retrieval | Unit: verify top 5 chunks returned by cosine similarity; verified via `EXPLAIN ANALYZE` on HNSW query |
| HNSW index used | SQL: `EXPLAIN ANALYZE` on similarity query → "HNSW" appears in query plan |
| Allocation guard — positive | Unit: LLM output contains "Allocate 25% to AAPL" → HTTP 422 `LLM_ALLOCATION_OUTPUT` |
| Allocation guard — no false positives | Unit: "A company's P/E ratio is 25x" → NOT flagged as allocation |
| 6-provider routing | Unit tests (mock) for anthropic, openai, google, groq, deepseek, openrouter |
| LLM_KEY_MISSING | Unit: call without key configured → HTTP 403 |
| LLM_API_ERROR | Unit: mock provider 500 → HTTP 502 with provider error message |
| Key never in browser | Security: `grep` provider domains in `app/(dashboard)/` → zero results |
| AiInsightTag — absent without key | Manual: llm_connected = false → PeerCard renders without tag (no empty placeholder) |
| AiInsightTag — present with cached data | Manual: llm_connected = true + cached research → PeerCard shows tag |
| DisclaimerBanner — non-dismissible | DevTools Elements inspection: no close/dismiss button |
| `formatNumber` used everywhere | `grep \.toFixed\(` in components → zero results |

---

## 5. Integration

### API Routes

| Method + Path | What It Does |
|---|---|
| `PATCH /api/profile` | Encrypts and stores LLM key |
| `GET /api/profile` | Returns `llm_connected`, `llm_provider`, `llm_model` (no ciphertext) |
| `POST /api/knowledge/ingest` | Default knowledge base ingest (chunk + embed + upsert) |
| `POST /api/knowledge/upload` | User document upload + ingest |
| `DELETE /api/knowledge/documents/:id` | Remove uploaded document from corpus |
| `POST /api/research/:ticker` | RAG + news + LLM inference + structured output |
| `GET /api/research/:ticker` | Read cached research session |

### Database Tables

| Table | RLS | Purpose |
|---|---|---|
| `knowledge_chunks` | Yes (owner only) | Per-user RAG corpus (default + uploads), HNSW index on `embedding` |
| `research_sessions` | Yes (owner only) | Per-user research output cache (24h TTL), structured JSONB output |
| `user_profiles` | Yes | Stores `llm_key_enc`, `llm_provider`, `llm_model` |

### Key Libraries

| File | Responsibility |
|---|---|
| `lib/llmRouter.ts` | 6-provider routing (Anthropic SDK + OpenAI SDK with base_url override) |
| `lib/ragIngest.ts` | Semantic chunking + embedding call routing |
| `lib/allocationGuard.ts` | Regex detection of allocation percentage recommendations in LLM output |
| `/knowledge/` | 10+ curated `.md` files for default knowledge base |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 7 — Asset Discovery** | `/research/[ticker]` triggered from Discover page peer selection |
| **Component 2 — Portfolio Data Layer** | Research triggered from holdings ticker click; news context from `news_cache` |
| **Component 5 — Market Data** | Current price context during research; Finnhub news articles |

### Feeds Into

| Component | How |
|---|---|
| **Component 7 — Asset Discovery** | `AiInsightTag` on `PeerCard` when `llm_connected = true` |
| **Component 9 — PWA** | `DisclaimerBanner` (Research Hub UI), page footer disclaimer |

### External APIs (via AI Gateway — OIDC, no key in browser)

| Provider | Used For |
|---|---|
| Google AI Studio | Embedding (`text-embedding-004`) + LLM (`gemini-2.0-flash`) |
| OpenAI | Embedding (`text-embedding-3-small`) + LLM (`gpt-4o-mini`) |
| Groq | LLM (`llama-3.3-70b-versatile`) — free tier |
| DeepSeek | LLM (`deepseek-chat`) — free tier |
| Anthropic | LLM (`claude-3-5-haiku`) — own SDK |
| OpenRouter | LLM (user-selected model) |

### UI Components

| Component | Where Used |
|---|---|
| `components/research/SentimentCard.tsx` | Research page |
| `components/research/RiskFactorsCard.tsx` | Research page |
| `components/research/NarrativeSummaryCard.tsx` | Research page |
| `components/research/DisclaimerBanner.tsx` | Research page (non-collapsible) |
| `components/research/LLMKeyGate.tsx` | Research page (blocks when no key) |
| `components/shared/AiInsightTag.tsx` | `PeerCard` on Discover page |
