# STORY-040 — asset_historical_data Table + yfinance UPSERT

## AGENT CONTEXT

**What this file is:** A user story specification for the `asset_historical_data` Supabase table and the stale-while-revalidate yfinance fetch service. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F11-R2 (Stale-While-Revalidate Cache Architecture)
**Connected to:** `docs/architecture/02-database-schema.md`, `docs/prd/features/F11-portfolio-projection-optimization.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- If any instruction in this story conflicts with `CLAUDE.md` or `DEVELOPMENT_LOOP.md`, see `CONFLICT_RESOLVER.md` for resolution procedure.

---

## 1. Story Header

| Field | Value |
|---|---|
| **Story ID** | STORY-040 |
| **Title** | asset_historical_data table + yfinance UPSERT |
| **Epic** | EPIC-11 — Portfolio Projection & Optimization |
| **Status** | Planned |
| **Assigned to** | — |
| **Estimated effort** | 1.5 developer-days |

---

## 2. User Story

As the system, I need to fetch and cache up to 5 years of daily price history for any ticker so that the optimization engine can calculate annualized returns and covariance without hitting yfinance rate limits.

---

## 3. Context

**PRD requirement this story implements:**
- [F11-R2]: The stale-while-revalidate cache architecture — check Supabase first, fetch from yfinance only if stale (>24h), and UPSERT the result.

**Why this story exists at this point in the build order:**
This is the data foundation. STORY-041 (the optimization API) depends on this table existing and the fetch service being available. STORY-042 and STORY-043 build on top of the API.

---

## 4. Dependencies

The following stories must be complete (✅ in PROGRESS.md) before this story starts:

- None — this is a foundational story. Phase 0 migrations (including v2.0 tables) are already complete per EPIC-09 setup.

*If this story has no dependencies, write: "None — this is a foundational story."*

---

## 5. Technical Context

**Database tables created:**
- `asset_historical_data` — global cache, no RLS — see `docs/architecture/02-database-schema.md`

**API endpoints implemented or consumed:**
- None (this story creates a service module, not an HTTP endpoint)

**Components implemented or extended:**
- None (this story creates server-side service code only)

**External services called (if any):**
- `yfinance` — `Ticker(symbol).history(period="5y")` — fetches OHLCV daily data
- Supabase — `upsert` into `asset_historical_data` — reads `last_updated` to decide cache freshness

---

## 6. Implementation Tasks

Tasks must be ordered so that each task can be committed independently. Maximum 1 developer-day per task.

1. **[Database migration task]** — Write SQL migration `19_asset_historical_data.sql` creating the `asset_historical_data` table. Run via Supabase migration CLI. Table: `ticker TEXT PRIMARY KEY`, `historical_prices JSONB NOT NULL`, `last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()`. No RLS (global cache, server-written only).

2. **[Service module task]** — Create `lib/price-history.ts` with:
   - `fetchPriceHistory(ticker: string): Promise<PriceSeries>` — checks cache first, fetches from yfinance if stale, upserts result
   - `PriceSeries` type: `{ ticker: string, prices: Array<{ date: string; close: number }>, last_updated: string }`
   - Cache TTL: 24 hours (`last_updated < NOW() - INTERVAL '24 hours'`)
   - yfinance fetch: `Ticker(ticker).history(period="5y")`, extract `Close` column, convert index to "YYYY-MM-DD" strings
   - On yfinance failure: throw a descriptive error with the ticker name

3. **[Test task]** — Write unit tests for `lib/price-history.ts`:
   - Cache hit: when `last_updated` < 24h, no yfinance call made
   - Cache miss: when ticker not in DB, yfinance is called and result is upserted
   - Stale cache: when `last_updated` > 24h, yfinance is called and result is upserted
   - Error handling: yfinance failure throws with ticker in message

---

## 7. Acceptance Criteria

1. Given a ticker not in `asset_historical_data`, when `fetchPriceHistory` is called, then yfinance is called, the data is stored in Supabase, and the result is returned.

2. Given a ticker in `asset_historical_data` with `last_updated` < 24 hours ago, when `fetchPriceHistory` is called, then no yfinance call is made and the cached data is returned.

3. Given a ticker in `asset_historical_data` with `last_updated` > 24 hours ago, when `fetchPriceHistory` is called, then yfinance is called and the cache is refreshed via UPSERT.

4. The SQL migration creates the table with the correct schema: `ticker TEXT PRIMARY KEY`, `historical_prices JSONB`, `last_updated TIMESTAMPTZ`.

5. The returned `PriceSeries.prices` array contains objects with `date` ("YYYY-MM-DD" string) and `close` (number) fields.

---

## 8. Definition of Done

Every item must be checked before marking this story Complete in PROGRESS.md.

- [ ] All acceptance criteria pass
- [ ] Tests written BEFORE implementation for `lib/price-history.ts` (TDD Red→Green→Refactor cycle followed)
- [ ] `pnpm test` passes with zero failures and coverage meets minimums in `docs/development/03-testing-strategy.md`
- [ ] Migration verified: table exists with correct schema in Supabase (query it directly after running migration)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `bd close <task-id> "STORY-040 complete — all DoD items verified"` run successfully
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

## 9. Notes

- `yfinance` returns a pandas DataFrame when called from Python. Since this is a TypeScript/Node.js service, use the npm package `yahoo-finance2` (the maintained Node.js alternative) or call yfinance via a Python subprocess if the Node.js library is insufficient. Evaluate `yahoo-finance2` first — it has the same data with better TypeScript types.
- If `yahoo-finance2` is insufficient for historical data, the Python endpoint (STORY-041) can handle the yfinance call directly. In that case, STORY-040 creates the table only and STORY-041 adds the Python yfinance fetch.
- The `assets.created_at` column represents when the ticker was first mapped in our system — it may not reflect the asset's actual IPO date. For the 3-month trading history check, use `assets.created_at` as a proxy (it is set when the user first adds the asset to a silo, meaning it has been traded on our platform).

---

## 10. New Feature Checklist

*Use this section only when creating a story for a feature added after v2.0.*

- [x] `docs/prd/features/F11-portfolio-projection-optimization.md` created with full requirement specification
- [ ] `docs/architecture/02-database-schema.md` updated (SQL migration written — asset_historical_data table)
- [ ] `docs/architecture/03-api-contract.md` updated if new endpoints are required (N/A — no HTTP endpoint in this story)
- [ ] `docs/architecture/04-component-tree.md` updated if new components are required (N/A — service module only)
- [x] `docs/architecture/05-build-order.md` will be updated when all Phase 10 stories are filed
- [ ] `docs/design/02-component-library.md` updated if new component patterns are required (N/A)
- [ ] `docs/design/03-screen-flows.md` updated with new page layout diagram (N/A)
- [x] `stories/epics.md` updated with new epic entry (EPIC-11 added to epics.md)
- [x] New EPIC folder created: `stories/EPIC-11-portfolio-projection-optimization/`
- [x] At least one story file created in the new epic folder using this template (this file)
- [ ] `CLAUDE.md` Critical Rules section updated if the new feature introduces new rules (none anticipated)
- [ ] `PROGRESS.md` updated to include the new epic in the build tracker table
- [ ] `README.md` updated if the new feature changes the platform support matrix (N/A)
