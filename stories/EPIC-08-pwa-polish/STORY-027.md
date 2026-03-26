# STORY-027 — PWA & Offline Support

## AGENT CONTEXT

**What this file is:** A user story specification for PWA configuration (next-pwa, manifest.json, service worker) and offline detection with cached data display. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** NFR Section 8.1 (PWA installability), NFR Section 8.2 (offline caching), NFR Section 8.3 (performance)
**Connected to:** `docs/architecture/04-component-tree.md` (OfflineBanner, AppShell offline state), `docs/design/03-screen-flows.md` (offline overlay), `docs/development/00-project-structure.md` (next.config.mjs location)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-08 — PWA & Polish
**Phase:** 7
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** All Phases 0–6 complete
**Blocks:** STORY-028, STORY-029

---

## User Story

As a user, I can install Rebalancify as a PWA on my mobile device, and I can view my last-known portfolio state when I am offline.

---

## Acceptance Criteria

1. `manifest.json` is present in `/public` with correct `name`, `short_name`, `icons` (192x192, 512x512), `theme_color` (`#1E3A5F`), `background_color` (`#F8F9FA`), `display: standalone`, `start_url: /overview`.
2. `next-pwa` is configured in `next.config.mjs`. A service worker is generated on `pnpm build`.
3. Lighthouse PWA audit on production URL scores ≥ 90.
4. Service worker caches the last successful API responses for: `GET /api/silos`, `GET /api/silos/:id/holdings`, `GET /api/news/portfolio`.
5. When `navigator.onLine = false`: `OfflineBanner` appears in AppShell. Portfolio data (last cached) is visible. Sync, Refresh, and Rebalance buttons are disabled with tooltip "Unavailable offline".
6. When offline mode serves cached data: a visible "Offline — showing data from [relative timestamp]" indicator appears below the `OfflineBanner`.
7. Offline → online transition: `OfflineBanner` disappears. User can manually trigger a refresh.
8. First offline load (after at least one online session): content visible in < 1 second.

---

## Tasks

- [ ] Install `next-pwa`: `npm install next-pwa`
- [ ] Configure `next.config.mjs` with next-pwa (disable in dev, enable in prod) — the project uses `.mjs` extension per `docs/development/00-project-structure.md`; do not create `next.config.ts`; modify the existing `.mjs` file
- [ ] Write `public/manifest.json`
- [ ] Generate PWA icons at 192x192 and 512x512 from logo
- [ ] Define service worker cache strategy (`NetworkFirst` for API calls, `CacheFirst` for static assets)
- [ ] Update `OfflineBanner` to show cached data timestamp
- [ ] Disable interactive buttons when offline
- [ ] Test: set browser to offline → verify cached data visible
- [ ] Test: first offline load < 1 second
- [ ] Run Lighthouse PWA audit → verify ≥ 90

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] Lighthouse PWA ≥ 90 (screenshot)
- [ ] Offline load time < 1 second (verified in DevTools → Throttling → Offline)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-027 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
