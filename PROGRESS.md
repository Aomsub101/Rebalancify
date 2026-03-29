# PROGRESS.md — Rebalancify Build Phase Tracker

## AGENT CONTEXT

**What this file is:** The living tracker of build progress across all epics and stories. Updated at the end of every story.
**Derived from:** TECH_DOCS_v1.2.md (DOC-05 Build Order), stories/epics.md
**Connected to:** CLAUDE.md (Current Build Phase section), all STORY-*.md files
**Critical rules for agents using this file:**

- Update this file at the end of every completed story — mark the checkbox and record the completion date.
- Also run `bd close <id> "<note>"` in the same step (Step 7 of DEVELOPMENT_LOOP.md).
- Also update `PROJECT_LOG.md` in the same commit — add a new entry at the top of the Completed Stories section using the entry template.
- Never mark a story complete if any Definition of Done item is unchecked.
- The "Active" marker must reflect exactly what is currently being worked on.
- If this file disagrees with `bd status`: PROGRESS.md is authoritative for human-readable history; `bd` is authoritative for dependency resolution and `bd ready` output.

---

## Overall Status

| Phase   | Epic                                    | Status         | Started    | Completed  |
| ------- | --------------------------------------- | -------------- | ---------- | ---------- |
| Phase 0 | EPIC-01 Foundation                      | ✅ Complete    | 2026-03-26 | 2026-03-27 |
| Phase 1 | EPIC-02 Silos & Holdings                | ✅ Complete    | 2026-03-27 | 2026-03-28 |
| Phase 2 | EPIC-03 Alpaca Integration              | ✅ Complete    | 2026-03-28 | —         |
| Phase 3 | EPIC-04 Broker Fetch                    | 🟡 In Progress | —         | —         |
| Phase 4 | EPIC-05 Drift & Overview                | ⬜ Planned     | —         | —         |
| Phase 5 | EPIC-06 News Feed                       | ⬜ Planned     | —         | —         |
| Phase 6 | EPIC-07 Discovery                       | ⬜ Planned     | —         | —         |
| Phase 7 | EPIC-08 PWA & Polish                    | ⬜ Planned     | —         | —         |
| Phase 8 | EPIC-09 AI Research Hub (v2.0)          | ⬜ Planned     | —         | —         |
| Phase 9 | EPIC-10 Multi-Platform Execution (v2.0) | ⬜ Planned     | —         | —         |

---

## EPIC-01 — Foundation (Phase 0)

| Story     | Title                                         | Status | Completed  |
| --------- | --------------------------------------------- | ------ | ---------- |
| STORY-001 | Supabase project + all migrations             | ✅     | 2026-03-26 |
| STORY-002 | Next.js scaffold + auth pages                 | ✅     | 2026-03-26 |
| STORY-003 | AppShell layout + SessionContext              | ✅     | 2026-03-27 |
| STORY-004 | Environment configuration + Vercel deployment | ✅     | 2026-03-27 |

---

## EPIC-02 — Silos & Holdings (Phase 1)

| Story     | Title                                           | Status | Completed  |
| --------- | ----------------------------------------------- | ------ | ---------- |
| STORY-005 | Profile API + Silo CRUD + list page             | ✅     | 2026-03-27 |
| STORY-006 | Asset search + ticker mapping                   | ✅     | 2026-03-27 |
| STORY-007 | Holdings CRUD (manual entry) + silo detail page | ✅     | 2026-03-28 |
| STORY-008 | Target weights editor                           | ✅     | 2026-03-28 |

---

## EPIC-03 — Alpaca Integration (Phase 2)

| Story      | Title                                                        | Status | Completed  |
| ---------- | ------------------------------------------------------------ | ------ | ---------- |
| STORY-009  | Alpaca key storage + sync endpoint                           | ✅     | 2026-03-28 |
| STORY-010  | Rebalance calculator (partial mode + session creation)       | ✅     | 2026-03-28 |
| STORY-010b | Rebalance calculator (full mode, pre-flight, cash injection) | ✅     | 2026-03-28 |
| STORY-011  | Rebalancing wizard execute API route (Alpaca + manual)       | ✅     | 2026-03-28 |
| STORY-011b | Rebalancing wizard UI (3-step: Config, Review, Result)       | ✅     | 2026-03-28 |
| STORY-012  | Rebalance history endpoints + UI                             | ✅     | 2026-03-28 |

---

## EPIC-04 — Broker Fetch (Phase 3)

| Story      | Title                                                | Status | Completed |
| ---------- | ---------------------------------------------------- | ------ | --------- |
| STORY-013  | BITKUB sync (wallet + ticker prices)                 | ✅     | 2026-03-28 |
| STORY-014  | InnovestX sync — Settrade equity branch             | ✅     | 2026-03-28 |
| STORY-014b | InnovestX sync — digital asset branch + Settings UI | ✅     | 2026-03-28 |
| STORY-015  | Schwab OAuth flow + token storage                    | ✅     | 2026-03-28 |
| STORY-015b | Schwab holdings sync + Settings UI                   | ✅     | 2026-03-28 |
| STORY-016  | Webull sync + settings sections                      | ✅     | 2026-03-28 |

---

## EPIC-05 — Drift & Overview (Phase 4)

| Story     | Title                                             | Status | Completed |
| --------- | ------------------------------------------------- | ------ | --------- |
| STORY-017 | Drift calculation endpoint + DriftBadge component | ✅     | 2026-03-28 |
| STORY-018 | FX rates endpoint + USD conversion toggle         | ✅     | 2026-03-28 |
| STORY-019 | Overview page (SiloCardList + GlobalDriftBanner)  | ✅     | 2026-03-29 |
| STORY-020 | Daily drift digest via Resend (pg_cron)           | ✅     | 2026-03-29 |

---

## EPIC-06 — News Feed (Phase 5)

| Story     | Title                                         | Status | Completed |
| --------- | --------------------------------------------- | ------ | --------- |
| STORY-021 | News fetch service + cache (Finnhub + FMP)    | ⬜     | —        |
| STORY-022 | Portfolio news endpoint (two-tier matching)   | ⬜     | —        |
| STORY-023 | News page UI (tabs, ArticleList, ArticleCard) | ⬜     | —        |

---

## EPIC-07 — Asset Discovery (Phase 6)

| Story     | Title                                            | Status | Completed |
| --------- | ------------------------------------------------ | ------ | --------- |
| STORY-024 | Peer assets endpoint (Finnhub + static fallback) | ⬜     | —        |
| STORY-025 | Top Movers endpoint (Finnhub/FMP + CoinGecko)    | ⬜     | —        |
| STORY-026 | Discover page UI                                 | ⬜     | —        |

---

## EPIC-08 — PWA & Polish (Phase 7)

| Story     | Title                               | Status | Completed |
| --------- | ----------------------------------- | ------ | --------- |
| STORY-027 | PWA config + offline detection      | ⬜     | —        |
| STORY-028 | Onboarding modal + progress banner  | ⬜     | —        |
| STORY-029 | Performance audit (all NFR targets) | ⬜     | —        |

---

## EPIC-09 — AI Research Hub (Phase 8 — v2.0)

| Story      | Title                                                       | Status | Completed |
| ---------- | ----------------------------------------------------------- | ------ | --------- |
| STORY-030  | LLM key storage + settings UI                               | ⬜     | —        |
| STORY-031  | RAG document ingest pipeline — default knowledge base      | ⬜     | —        |
| STORY-031b | RAG user document upload + corpus management                | ⬜     | —        |
| STORY-032  | Research endpoint — RAG + LLM routing (6 providers)        | ⬜     | —        |
| STORY-032b | Research endpoint — allocation guard + provider unit tests | ⬜     | —        |
| STORY-033  | Research Hub UI (structured cards + disclaimer)             | ⬜     | —        |

---

## EPIC-10 — Multi-Platform Execution (Phase 9 — v2.0)

*Story files deferred. Will be created at the start of Phase 9 (when EPIC-09 reaches 80% completion). See `stories/epics.md` and `docs/architecture/05-build-order.md` Phase 9 for full task breakdown.*

| Story     | Title                                                              | Status | Completed |
| --------- | ------------------------------------------------------------------ | ------ | --------- |
| STORY-034 | BITKUB automated order execution                                   | ⬜     | —        |
| STORY-035 | InnovestX automated order execution                                | ⬜     | —        |
| STORY-036 | Charles Schwab automated order execution                           | ⬜     | —        |
| STORY-037 | Webull automated order execution                                   | ⬜     | —        |
| STORY-038 | Execution result UI — remove MANUAL badge for automated platforms | ⬜     | —        |
| STORY-039 | Settings — remove manual-only notices for automated platforms     | ⬜     | —        |

---

## Legend

| Symbol | Meaning                               |
| ------ | ------------------------------------- |
| ⬜     | Not started                           |
| 🟡     | In progress                           |
| ✅     | Complete (all DoD items verified)     |
| 🔴     | Blocked — see story file for details |
