# STORY-006 — Asset Search, Mapping & Price Caching

## AGENT CONTEXT

**What this file is:** A user story specification for asset search, ticker confirmation, permanent asset-to-silo mapping, and initial price caching. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R5 (asset search), F2-R6 (ticker confirmation, one-time mapping)
**Connected to:** `docs/architecture/02-database-schema.md` (assets, asset_mappings, price_cache tables), `docs/architecture/03-api-contract.md` (asset search and mapping endpoints), `docs/architecture/04-component-tree.md` (AssetSearchModal)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-02 — Silos & Holdings
**Phase:** 1
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-005
**Blocks:** STORY-007, STORY-008

---

## User Story

As a user, I can search for any stock, ETF, or crypto asset, confirm the correct ticker, and have the mapping permanently stored so I never repeat this step for the same asset in the same silo.

---

## Acceptance Criteria

1. `GET /api/assets/search?q=apple&type=stock` returns a ranked list of matching stocks from Finnhub.
2. `GET /api/assets/search?q=bitcoin&type=crypto` returns matching cryptos from CoinGecko.
3. `POST /api/silos/:id/asset-mappings` with a valid ticker creates a row in `assets` (if not existing) and a row in `asset_mappings`. Returns `{ asset_id, mapping_id, ticker }`.
4. Adding the same ticker to the same silo a second time returns HTTP 409 `ASSET_MAPPING_EXISTS` — does not create a duplicate.
5. Adding the same ticker to a *different* silo creates a new `asset_mappings` row (different silo scope).
6. After `POST /api/silos/:id/asset-mappings`, the price for that asset is fetched and cached in `price_cache` (via `priceService.ts`).
7. A second price fetch within 15 minutes does not call the external API — it returns the cached price. Verified by counting external API calls.
8. `AssetSearchModal` opens when clicking "Add asset" in the silo detail. Shows TypeSelector (Stock/ETF | Crypto), debounced search input, results list.
9. Selecting a result and confirming calls `POST /asset-mappings` and closes the modal, then the new asset appears in the holdings table with `quantity: 0`.
10. If Finnhub or CoinGecko is unreachable, `GET /api/assets/search` returns HTTP 503 with `BROKER_UNAVAILABLE`.

---

## Tasks

- [ ] Write `lib/priceService.ts` (three-tier: check `price_cache_fresh` → Finnhub/CoinGecko/etc.)
- [ ] Write `app/api/assets/search/route.ts`
- [ ] Write `app/api/silos/[silo_id]/asset-mappings/route.ts`
- [ ] Write `components/silo/AssetSearchModal.tsx`
- [ ] Unit test: priceService cache hit (no external call within 15 min)
- [ ] Unit test: duplicate mapping → 409
- [ ] Unit test: same ticker, different silo → two mappings (expected)

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] Unit tests for cache hit and duplicate mapping
- [ ] Price cache row exists in DB after asset is mapped
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-006 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
