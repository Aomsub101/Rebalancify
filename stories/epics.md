# epics.md — Epic Definitions & Status

## AGENT CONTEXT

**What this file is:** The master list of all epics, their scope, PRD mapping, and current status.
**Derived from:** PRD_v1.3.md, TECH_DOCS_v1.2.md (DOC-05 Build Order)
**Connected to:** PROGRESS.md, stories/EPIC-*/STORY-*.md, docs/architecture/05-build-order.md
**Critical rules for agents using this file:**
- Epic status must match PROGRESS.md at all times. If they differ, PROGRESS.md is authoritative.
- New epics for post-v2.0 features are added at the bottom following the same format.

---

## EPIC-01 — Foundation

**Phase:** 0
**Version:** v1.0
**Status:** ✅ Complete (2026-03-27)
**PRD mapping:** Section 5 (System Architecture), Section 5.1–5.2 (Deployment, Tech Stack)
**Scope:** Supabase project setup, all database migrations, Next.js scaffold, authentication flow, AppShell, Vercel deployment pipeline. This epic produces the authenticated shell that all other epics build on top of. Nothing else should be started before this epic is complete.

| Story | Title | Effort |
|---|---|---|
| STORY-001 | Supabase project + all migrations | 1d |
| STORY-002 | Next.js scaffold + auth pages | 1d |
| STORY-003 | AppShell layout + SessionContext | 1d |
| STORY-004 | Environment configuration + Vercel deployment | 0.5d |

---

## EPIC-02 — Silos & Holdings

**Phase:** 1
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F2-R1 through F2-R7, F1-R1, F1-R3, F1-R4
**Scope:** Full CRUD for silos, asset search and ticker mapping, manual holdings entry, and target weights editor. Produces the core portfolio data layer that all calculation and display features depend on.

| Story | Title | Effort |
|---|---|---|
| STORY-005 | Profile API + Silo CRUD + list page | 1.5d |
| STORY-006 | Asset search + ticker mapping | 1.5d |
| STORY-007 | Holdings CRUD (manual entry) + silo detail page | 2d |
| STORY-008 | Target weights editor | 1d |

---

## EPIC-03 — Alpaca Integration

**Phase:** 2
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F1-R2, F1-R5 through F1-R10, F2-R7 (Alpaca row)
**Scope:** Alpaca API key storage (encrypted), sync endpoint, the full rebalancing calculator (partial + full mode, cash injection, pre-flight validation, session immutability), Alpaca order execution, 3-step wizard UI, and rebalancing history.

| Story | Title | Effort |
|---|---|---|
| STORY-009 | Alpaca key storage + sync endpoint | 1d |
| STORY-010 | Rebalance calculator (partial mode + session creation) | 1.5d |
| STORY-010b | Rebalance calculator (full mode, pre-flight, cash injection) | 1.5d |
| STORY-011 | Rebalancing wizard execute API route (Alpaca + manual) | 1.5d |
| STORY-011b | Rebalancing wizard UI (3-step: Config, Review, Result) | 1.5d |
| STORY-012 | Rebalance history endpoints + UI | 1d |

---

## EPIC-04 — Broker Fetch

**Phase:** 3
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F2-R7 (BITKUB, InnovestX, Schwab, Webull rows), Section 4.3–4.6
**Scope:** Holdings fetch automation for the four non-Alpaca API platforms. In v1.0 these platforms fetch holdings only — order execution is deferred to v2.0. Includes Schwab OAuth flow (7-day token refresh handling) and settings sections for all brokers.

| Story | Title | Effort |
|---|---|---|
| STORY-013 | BITKUB sync (wallet + ticker prices) | 1.5d |
| STORY-014 | InnovestX sync — Settrade equity branch | 1.5d |
| STORY-014b | InnovestX sync — digital asset branch + Settings UI | 1.5d |
| STORY-015 | Schwab OAuth flow + token storage | 1.5d |
| STORY-015b | Schwab holdings sync + Settings UI | 1.5d |
| STORY-016 | Webull sync + full broker settings UI | 1.5d |

---

## EPIC-05 — Drift & Overview

**Phase:** 4
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F5-R4, F5-R5, F2-R4, F2-R5, F2-R6
**Scope:** Drift calculation (three-state badge), FX rates and USD conversion toggle, the global Overview page (silo cards, drift banner, silo count badge), and the daily drift digest delivery via Resend + pg_cron.

| Story | Title | Effort |
|---|---|---|
| STORY-017 | Drift calculation endpoint + DriftBadge component | 1d |
| STORY-018 | FX rates endpoint + USD conversion toggle | 1d |
| STORY-019 | Overview page (SiloCardList + GlobalDriftBanner) | 1.5d |
| STORY-020 | Daily drift digest via Resend (pg_cron) | 1d |

---

## EPIC-06 — News Feed

**Phase:** 5
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F4-R1 through F4-R7
**Scope:** News fetch service (Finnhub + FMP with rate-limit handling), global cache with per-user read/dismiss state, Portfolio News (two-tier ticker matching), Macro News, and the full News page UI.

| Story | Title | Effort |
|---|---|---|
| STORY-021 | News fetch service + global cache | 1.5d |
| STORY-022 | Portfolio news endpoint (two-tier matching) | 1d |
| STORY-023 | News page UI (tabs, ArticleList, ArticleCard) | 1.5d |

---

## EPIC-07 — Asset Discovery

**Phase:** 6
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** F5-R1, F5-R2, F5-R3
**Scope:** Peer assets endpoint (Finnhub + static sector fallback), Top Gainers/Losers (US stocks via Finnhub/FMP + crypto via CoinGecko), and the Discover page UI.

| Story | Title | Effort |
|---|---|---|
| STORY-024 | Peer assets endpoint (Finnhub + static fallback) | 1d |
| STORY-025 | Top Movers endpoint (Finnhub/FMP + CoinGecko) | 1d |
| STORY-026 | Discover page UI | 1.5d |

---

## EPIC-08 — PWA & Polish

**Phase:** 7
**Version:** v1.0
**Status:** ⬜ Planned
**PRD mapping:** Section 8.1–8.4 (NFRs), Section 6 (Onboarding in design_preferences)
**Scope:** next-pwa integration, service worker, offline detection (OfflineBanner), onboarding modal (first login only), progress banner, LoadingSkeleton and ErrorBanner standardisation, and the final NFR performance audit.

| Story | Title | Effort |
|---|---|---|
| STORY-027 | PWA config + offline detection | 1d |
| STORY-028 | Onboarding modal + progress banner | 1d |
| STORY-029 | Performance audit (all NFR targets) | 0.5d |

---

## EPIC-09 — AI Research Hub (v2.0)

**Phase:** 8
**Version:** v2.0
**Status:** ⬜ Planned
**PRD mapping:** F3-R1 through F3-R7, Section 5.4–5.5 (RAG + LLM architecture)
**Scope:** LLM API key storage for 6 providers (Google, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter), RAG document ingest pipeline (semantic chunking + pgvector), research endpoint (cosine similarity + LLM inference routing), and the Research Hub UI (structured cards, persistent disclaimer). Depends on STORY-009 (EPIC-03) being complete — the AES-256-GCM key encryption pattern is established there and reused here for LLM key storage.

| Story | Title | Effort |
|---|---|---|
| STORY-030 | LLM key storage + settings UI | 1d |
| STORY-031 | RAG document ingest pipeline — default knowledge base | 1.5d |
| STORY-031b | RAG user document upload + corpus management | 1.5d |
| STORY-032 | Research endpoint — RAG + LLM routing (6 providers) | 1.5d |
| STORY-032b | Research endpoint — allocation guard + provider unit tests | 1.5d |
| STORY-033 | Research Hub UI (structured cards + disclaimer) | 1.5d |

---

## EPIC-10 — Multi-Platform Execution (v2.0)

**Phase:** 9
**Version:** v2.0
**Status:** ⬜ Planned
**PRD mapping:** `docs/architecture/05-build-order.md` Phase 9 tasks 9.1–9.6
**Scope:** Automated order execution for BITKUB, InnovestX, Charles Schwab, and Webull. Extends the execute endpoint from EPIC-03 (Alpaca only) to all API-connected platforms. Story files will be written when Phase 8 (EPIC-09) reaches 80% completion.
**Blocked by:** EPIC-03 (Alpaca execute pattern), EPIC-04 (all broker syncs working), EPIC-09 (v2.0 key infrastructure complete)

| Story | Title | Effort |
|---|---|---|
| STORY-034 | BITKUB automated order execution | 2d |
| STORY-035 | InnovestX automated order execution | 2d |
| STORY-036 | Charles Schwab automated order execution | 2d |
| STORY-037 | Webull automated order execution | 2d |
| STORY-038 | Execution result UI — remove MANUAL badge for newly automated platforms | 1d |
| STORY-039 | Settings — remove manual-only execution notices for newly automated platforms | 0.5d |

*Story files are deferred. Create `stories/EPIC-10-multi-platform-execution/STORY-034.md` through `STORY-039.md` at the start of Phase 9 using `stories/STORY-TEMPLATE.md`.*

---

## EPIC-11 — Portfolio Projection & Optimization (v2.0)

**Phase:** 10
**Version:** v2.0
**Status:** ⬜ Planned
**PRD mapping:** `docs/prd/features/F11-portfolio-projection-optimization.md` (F11-R1 through F11-R14)
**Scope:** yfinance historical data caching layer, Python scipy.optimize serverless endpoint with three mean-variance strategies (Global Min Volatility, Max Sharpe, Target Risk), SimulateScenariosButton with min-2-assets and min-3-months constraints, SimulationResultsTable with TruncationWarning and Apply Weights wiring. Lives inline in SiloDetailPage.
**Blocked by:** EPIC-09 (complete — required for Phase 10 start)

| Story | Title | Effort |
|---|---|---|
| STORY-040 | `asset_historical_data` table + yfinance UPSERT | 1.5d |
| STORY-041 | Python optimization API (`POST /api/optimize`) | 2d |
| STORY-042 | SimulateScenariosButton + constraint logic | 1.5d |
| STORY-043 | SimulationResultsTable + Apply Weights wiring | 1.5d |
