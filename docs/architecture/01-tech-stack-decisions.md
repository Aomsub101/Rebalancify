# docs/architecture/01-tech-stack-decisions.md — Tech Stack Decisions (ADR)

## AGENT CONTEXT

**What this file is:** Architecture Decision Records (ADRs) explaining every major technology choice. Do not substitute technologies without creating a new ADR entry and updating CLAUDE.md.
**Derived from:** TECH_DOCS_v1.2.md (DOC-04 Architecture Decision Record)
**Connected to:** CLAUDE.md (Tech Stack table), docs/architecture/00-system-overview.md
**Critical rules for agents using this file:**
- All decisions are "Accepted" — do not re-litigate them without explicit user instruction.
- Adding a new technology requires a new ADR entry, a CLAUDE.md update, and justification against the free-tier constraint.

---

## ADR-001 — Supabase as All-in-One Backend

**Status:** Accepted
**Decision:** Use Supabase for PostgreSQL database, authentication, vector store (v2.0), and file storage (v2.0).
**Rationale:** Avoids three separate vendors (a dedicated DB, an auth service, and a vector DB). All features available in the free tier (500 MB storage, 50,000 MAU). pgvector is built-in — no extra deployment needed for RAG.
**Constraints:** 500 MB storage budget is shared across database, vector store, and uploaded documents. Monitor usage in STORY-031.

---

## ADR-002 — Next.js App Router as Full-Stack Framework

**Status:** Accepted
**Decision:** Use Next.js 15 with App Router for both the frontend and backend API routes.
**Rationale:** PWA support + SSR + API route proxying for external API keys — all in one framework with zero-config Vercel deployment. API routes act as the security boundary: external API keys live in Vercel environment variables, never in the browser bundle.
**Constraints:** No `<form>` tags (PWA compatibility). All styling via Tailwind only.

---

## ADR-003 — Supabase pgvector for RAG (v2.0)

**Status:** Accepted
**Decision:** Use Supabase's built-in pgvector extension for vector similarity search.
**Rationale:** Already in stack — zero additional vendor, zero additional cost. For a 50–500 document corpus (~30 MB), pgvector with HNSW indexing delivers sub-100ms retrieval latency.
**Upgrade path:** LightRAG + Qdrant for >10,000 documents (v3.0).

---

## ADR-004 — Immutable Rebalance Session Blocks

**Status:** Accepted
**Decision:** `rebalance_sessions` rows are created once and never updated. `snapshot_before` JSONB captures the full input state at calculation time.
**Rationale:** External trades made outside the app would corrupt history if sessions referenced live holdings. The immutable snapshot ensures historical records are always self-consistent regardless of what the user does on their brokerage platform.
**Constraint:** No `UPDATE` statements on `rebalance_sessions`. Enforced via code review and a linting rule.

---

## ADR-005 — User-Supplied LLM API Keys (BYOK)

**Status:** Accepted
**Decision:** The app supplies no LLM API key. Users bring their own key (BYOK) from one of six supported providers.
**Rationale:** Zero LLM inference cost to the developer. Feature is gated until a key is configured. Three free-tier options (Google AI Studio, Groq, DeepSeek) mean the feature is accessible to users who cannot spend money.

---

## ADR-006 — Finnhub Peers + Static Fallback for Asset Discovery

**Status:** Accepted
**Decision:** Asset peer discovery uses Finnhub's `/stock/peers` endpoint with a static `sector_taxonomy.json` as an offline fallback.
**Rationale:** Accurate peer data without LLM dependency. Static fallback enables offline PWA functionality for the Discover page.

---

## ADR-007 — LLM Provider Architecture — Direct Keys + Optional OpenRouter

**Status:** Accepted (v1.2 revision)
**Decision:** Five direct provider keys are always supported (Google, Groq, DeepSeek, OpenAI, Anthropic). OpenRouter is an optional convenience gateway — never required.
**Rationale:** Direct keys are never inferior to OpenRouter. Users with free-tier direct keys (Google AI Studio, Groq, DeepSeek) pay nothing to use the Research Hub. OpenRouter adds flexibility for users who want access to 400+ models from a single key.
**Implementation note:** Anthropic requires the Anthropic SDK with custom `anthropic-version` header. All other providers use the OpenAI SDK with a changed `base_url`.

---

## ADR-008 — BITKUB Official REST API

**Status:** Accepted
**Decision:** Use BITKUB's official public REST API with HMAC-SHA256 authentication.
**Rationale:** Well-documented public API. Holdings fetch is stable. Order execution deferred to v2.0 for additional stability testing.

---

## ADR-009 — Silo Limit of 5

**Status:** Accepted
**Decision:** Maximum 5 active silos per user, enforced at the application layer (not a DB constraint).
**Rationale:** Protects the 500 MB Supabase free-tier budget. The target persona typically uses 2–4 platforms — 5 is more than sufficient. Soft deletion (`is_active = FALSE`) allows the user to deactivate and reactivate silos without losing data, which is why the limit is application-layer (not DB constraint).

---

## ADR-010 — Alpaca Execution in v1.0; All Other Brokers in v2.0

**Status:** Accepted
**Decision:** Only Alpaca supports automated order execution in v1.0. BITKUB, InnovestX, Schwab, and Webull all defer execution to v2.0.
**Rationale:** Alpaca has the most mature API documentation, paper trading mode for safe testing, and was the original integration target. Grouping all non-Alpaca execution in v2.0 creates a clean "multi-platform execution release" story.

---

## ADR-011 — Resend as Transactional Email Provider

**Status:** Accepted
**Decision:** Use Resend for daily drift digest emails.
**Rationale:** 3,000 emails/month free. Native Next.js integration (official SDK). Current industry best practice for Vercel-hosted apps. Simple API. Used for drift digest only — no marketing email.

---

## ADR-012 — PDPA Compliance Posture

**Status:** Accepted
**Decision:** Hosted application implements formal data controller requirements at launch.
**Requirements:** Published privacy policy, data processing register, user data deletion mechanism, data minimisation practices.
**Thai PDPC registration:** Completed if and when user base reaches a scale that triggers the requirement.

---

## ADR-013 — Drift Digest Email Delivery: Vercel Cron, Not pg_cron

**Status:** Accepted
**Decision:** The daily drift digest email is sent by a Vercel Cron Job (`/api/cron/drift-digest`) — not from inside a pg_cron SQL function.
**Rationale:** `pg_cron` executes SQL inside PostgreSQL. PostgreSQL cannot make outbound HTTP calls to the Resend API without `pg_net`, which would require the `RESEND_API_KEY` to be embedded in a SQL function body — a direct violation of CLAUDE.md Rule 4 (API keys never in DB). Vercel Cron Jobs run as ordinary Next.js API route handlers, have full access to Vercel environment variables, and call Resend via the official SDK already in the dependency tree.
**Architecture:** migration 17 (`17_pg_cron_drift_digest.sql`) handles ONLY the in-app notification INSERT. The Vercel Cron Job at `app/api/cron/drift-digest/route.ts` handles email dispatch. Both run at 08:00 UTC. The cron schedule is declared in `vercel.json` at the project root.
**Constraint:** The Vercel Cron Job endpoint must validate a `CRON_SECRET` header to prevent unauthorised invocation. Add `CRON_SECRET` to `docs/development/01-dev-environment.md` environment variable table.

---

## ADR-014 — ExchangeRate-API Free Tier Quota Awareness

**Status:** Accepted
**Decision:** Use ExchangeRate-API free tier with a 60-minute TTL cache and explicit quota exhaustion handling.
**Free tier limit:** 1,500 requests/month. At one request per currency pair per 60 minutes with typical usage, this is sufficient. Monitor monthly.
**Quota exhaustion behaviour:** HTTP 429 from ExchangeRate-API must be logged as `EXCHANGERATE_QUOTA_EXHAUSTED` (distinct from a transient outage) and handled identically in the UI — disable the USD toggle, show "FX data unavailable". Recovery is automatic on the 1st of the following month.
**Upgrade path:** ExchangeRate-API Pro ($14.99/month) provides 30,000 requests/month if traffic outgrows the free tier.
