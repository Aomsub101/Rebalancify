# docs/prd/features/F3-ai-research-hub.md — Feature 3: AI Research Hub ("The Trust Engine") — v2.0

## AGENT CONTEXT

**What this file is:** Requirements for the AI-powered qualitative research feature (v2.0 only).
**Derived from:** PRD_v1.3.md Section 6 Feature 3, Section 5.4–5.5, FEATURES_v1.3.txt Feature 3
**Connected to:** docs/architecture/02-database-schema.md (knowledge_chunks, research_sessions), docs/architecture/03-api-contract.md (Research endpoint), stories/EPIC-09-ai-research-hub/
**Critical rules for agents using this file:**
- F3-R5 is a regulatory red line: the AI must NEVER output a specific target weight percentage. Enforced at system prompt level.
- F3-R6 disclaimer is non-negotiable: must appear on every AI output surface, always visible, never collapsible.
- This entire feature is v2.0. Do not implement any part in v1.0.
- All LLM API calls must be proxied through Next.js API routes. Keys never reach the browser.

---

## Feature Purpose

A multi-agent LLM system that surfaces qualitative insights about a specific asset by aggregating recent news, expert sentiment, and principles from an uploaded financial literature knowledge base (RAG). Strictly a decision-support tool — never recommends target weights. Requires a user-supplied LLM API key, with multiple free-tier options available.

---

## Requirements

### F3-R1 — Research Session Triggers

Research sessions may be triggered in two ways:
1. A user manually searches for any ticker symbol from the Discover page or Research Hub.
2. A user selects an asset directly from their existing portfolio holdings within a silo.

**Implementation constraint:** Both trigger paths must route to `POST /research/:ticker` with the same request shape. The source (manual search vs. portfolio) is logged in `research_sessions.metadata` for analytics but does not change the output.

---

### F3-R2 — RAG Knowledge Base

The RAG knowledge base ships with a curated default set of financial literature summaries in Markdown format, stored in a `/knowledge` directory at the repository root. Users may upload additional documents to extend their personal knowledge base.

**Default knowledge file content format:**
- **Length:** 500–3,000 words per file. Files shorter than 500 words produce single-chunk documents that underperform in retrieval.
- **Heading structure:** Use H2 headings (`##`) to mark major topic sections. The semantic chunker splits on heuristic similarity drops but H2 boundaries serve as hard split points.
- **Supported Markdown:** Headers (H1–H3), bullet lists, numbered lists, bold/italic, blockquotes. No HTML, no code fences (`` ``` ``), no tables (they chunk poorly).
- **Citations:** End each file with a `## Sources` section listing references. These appear in the `sources` array of the research output.
- **First line:** Must be an H1 heading that is the document title. This becomes the `title` field in `metadata`.

**Architecture:**
- Documents are chunked using semantic splitting (split at topic-boundary similarity drops).
- Each chunk is embedded using a **dedicated embedding provider**, separate from the inference provider. This is necessary because Groq, DeepSeek, and Anthropic do not expose public embedding endpoints. The embedding provider is configured via the `EMBEDDING_PROVIDER` environment variable (server-side only).

**Embedding provider options (in order of recommendation for free-tier users):**

| Provider | Model | Dimension | Free Tier | Env Var |
|---|---|---|---|---|
| Google (default) | `text-embedding-004` | 768 → padded to 1536 | Yes | `EMBEDDING_PROVIDER=google`, `EMBEDDING_API_KEY` |
| OpenAI | `text-embedding-3-small` | 1536 native | No (paid) | `EMBEDDING_PROVIDER=openai`, `EMBEDDING_API_KEY` |

**Server-side routing logic:**
```
if EMBEDDING_PROVIDER == 'google':
  call googleapis.com/v1/models/text-embedding-004:embedContent
  pad output from 768 to 1536 dimensions with zeros (right-pad)
elif EMBEDDING_PROVIDER == 'openai':
  call OpenAI embeddings endpoint with text-embedding-3-small
```

**Note on dimension padding:** Google `text-embedding-004` natively outputs 768 dimensions. To remain compatible with the `vector(1536)` column defined in Phase 0, pad the vector to 1536 by appending 768 zeros. This is lossless — cosine similarity is unaffected because the zero-padded dimensions contribute nothing to the dot product. All embeddings in a user's knowledge base will use the same provider and padding scheme, so retrieval remains consistent.

- Chunks stored in `knowledge_chunks` table with `embedding vector(1536)` and HNSW index.
- Retrieval: cosine similarity search + optional keyword filter on `metadata` JSONB.

**Storage constraint:** A 500-document corpus ≈ 30 MB — within the 500 MB Supabase free-tier budget. Monitor corpus size at ingest time and warn users approaching 80% of the 500 MB total budget.

---

### F3-R3 — LLM Provider Support (BYOK)

The feature requires the user to supply a valid LLM API key in Settings. Supported providers:

| Provider | Free Tier | Model Example | Protocol |
|---|---|---|---|
| Google AI Studio | Yes — free | Gemini 2.0 Flash | OpenAI-compatible (`https://generativelanguage.googleapis.com/v1beta/openai/`) |
| Groq | Yes — generous | Llama 3.3 70B | OpenAI-compatible (`https://api.groq.com/openai/v1`) |
| DeepSeek | Yes — with limits | DeepSeek-V3 | OpenAI-compatible (`https://api.deepseek.com`) |
| OpenAI | No (paid) | GPT-4o Mini | Native OpenAI SDK |
| Anthropic | No (paid) | Claude 3.5 Haiku | Anthropic SDK (special handling — `anthropic-version` header required) |
| OpenRouter | Some free models | Any | OpenAI-compatible (`https://openrouter.ai/api/v1`) |

**Backend routing:**
```
if provider == 'anthropic':
  use Anthropic SDK with anthropic-version header
elif provider in ['openai']:
  use OpenAI SDK with native base_url
else (google, groq, deepseek, openrouter):
  use OpenAI SDK with provider-specific base_url
```

**Gate behaviour:** If no API key is configured, all AI-dependent UI elements display: `"To use the Research Hub, add your LLM API key in Settings."` The Research Hub page renders this message instead of the research interface. No partial rendering.

---

### F3-R4 — Structured Output Format

Output is rendered as structured cards with expandable detail text. Each research card must include:

| Card Section | Content | Constraint |
|---|---|---|
| Sentiment Score | `bullish` / `neutral` / `bearish` + confidence indicator (0.0–1.0) | Rendered as a coloured badge + numeric confidence |
| Key Risk Factors | Bulleted list of identified risks | Minimum 2, maximum 8 items |
| Narrative Summary | Aggregated analysis grounded in retrieved knowledge and recent news | 150–300 words |

**Output schema (stored in `research_sessions.output` JSONB):**
```json
{
  "sentiment": "bullish | neutral | bearish",
  "confidence": 0.82,
  "risk_factors": ["string", "string"],
  "summary": "string (150-300 words)",
  "sources": ["string"]
}
```

---

### F3-R5 — AI Output Restrictions (Regulatory Red Line)

The AI system must never output a specific percentage allocation recommendation (e.g., "Set AAPL weight to 25%"). This restriction is enforced at the system prompt level:

**System prompt constraint (must be present in every LLM call):**
> "You are a financial research assistant. You may provide sentiment analysis, risk factors, and narrative summaries based on the provided context. You must never recommend, suggest, or imply a specific portfolio allocation percentage for any asset. If the user's query asks for allocation advice, decline and explain that you provide research only."

This constraint cannot be overridden by user input. If the LLM output contains a percentage allocation despite the system prompt, the backend must detect and reject it before returning to the client.

---

### F3-R6 — Persistent Financial Disclaimer

All AI output surfaces must display the following disclaimer, always visible, never collapsible:

> "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions."

**Implementation constraint:** This disclaimer must also appear in the footer of every page (all pages, not just AI pages). See `CLAUDE.md` Rule 14.

---

### F3-R7 — Research Session Caching

Research sessions are cached per user in Supabase after initial generation (`research_sessions` table). Users may retrieve a cached session without re-invoking the LLM API. Cache invalidation occurs only when the user explicitly requests a refresh.

**Implementation constraint:** On `POST /research/:ticker`, the API checks for an existing `research_sessions` row for the same `(user_id, ticker)`. If one exists and `refreshed_at IS NULL OR refreshed_at < 24 hours ago`, return the cached output without calling the LLM. If the user clicks "Refresh", set `refreshed_at = NOW()` and re-invoke the LLM.
