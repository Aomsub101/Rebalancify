# STORY-026 — Discover Page UI

## AGENT CONTEXT

**What this file is:** A user story specification for the Discover page UI — TopMoversTabs, AssetPeerSearch, PortfolioDriftSummary, and PeerCard grid. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F5-R1 (peer discovery UI), F5-R2 (static fallback), F5-R3 (top movers UI)
**Connected to:** `docs/architecture/04-component-tree.md` (Discover page section, TopMoversTabs, AssetPeerSearch, PeerCard, PortfolioDriftSummary), `docs/design/03-screen-flows.md` (Discover Page layout), `docs/design/CLAUDE_FRONTEND.md` (PeerCard grid class)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-07 — Discovery
**Phase:** 6
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-024, STORY-025, STORY-017
**Blocks:** Nothing

---

## User Story

As a user, I can browse the Discover page to see market top movers, search for peer assets, and view the drift summary of my portfolio.

---

## Acceptance Criteria

1. Discover page: `TopMoversTabs` (US Stocks | Crypto), `AssetPeerSearch`, `PortfolioDriftSummary`.
2. `TopMoversTable` shows gainers (green) and losers (red), each with icon.
3. `AssetPeerSearch`: search input → calls `GET /api/assets/search` → select an asset → calls `GET /api/assets/:id/peers` → renders `PeerCard` grid.
4. `PeerCard`: ticker, name, current price. No `AiInsightTag` in v1.0.
5. `PortfolioDriftSummary`: one `DriftSiloBlock` per silo, showing each asset's `DriftBadge`.
6. All three sections have `LoadingSkeleton` and `EmptyState`.

---

## Tasks

- [ ] Write `app/(dashboard)/discover/page.tsx`
- [ ] Write `PeerCard` component
- [ ] Wire three sections to their respective API endpoints
- [ ] Verify: no AiInsightTag in DOM (grep → zero results in v1.0)

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] AiInsightTag not in DOM (grep verification)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-026 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
