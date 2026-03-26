# STORY-018 — FX Rates (USD Toggle)

## AGENT CONTEXT

**What this file is:** A user story specification for the FX rates endpoint with 60-minute cache TTL and the USD conversion toggle on the Overview page. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R4 (multi-currency display), F5-R6 (USD conversion toggle)
**Connected to:** `docs/architecture/02-database-schema.md` (fx_rates table, user_profiles show_usd_toggle), `docs/architecture/03-api-contract.md` (fx-rates endpoint), `docs/architecture/04-component-tree.md` (USD toggle, SiloCard currency display)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-05 — Drift & Overview
**Phase:** 4
**Estimate:** 0.5 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-001 (fx_rates table)
**Blocks:** STORY-019

---

## User Story

As a user with multi-currency silos, I can toggle a "Convert all to USD" switch on the Overview page to see portfolio values normalised in USD.

---

## Acceptance Criteria

1. `GET /api/fx-rates` returns `{ [currency]: { rate_to_usd, fetched_at } }` for all currencies needed.
2. If `fetched_at` is within 60 minutes, returns cached rates — no ExchangeRate-API call.
3. If stale, calls ExchangeRate-API, upserts `fx_rates`, and returns fresh rates.
4. If ExchangeRate-API is unavailable: returns last cached rates with the original `fetched_at`. Does not error.
5. USD toggle state stored in `user_profiles.show_usd_toggle`. Persists across sessions.
6. When toggle is off: each silo shows value in its `base_currency`.
7. When toggle is on: values converted to USD using `rate_to_usd` — display only, no DB writes.
8. If `GET /api/fx-rates` fails: toggle is disabled with tooltip "FX data unavailable".

---

## Tasks

- [ ] Write `app/api/fx-rates/route.ts` (60-min TTL, graceful fallback)
- [ ] Add USD toggle to Overview TopBar (calls `PATCH /api/profile` to persist)
- [ ] Update SiloCard: show converted USD value when toggle is on

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] Test: second call within 60 min → no ExchangeRate-API call
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-018 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
