# Component 9 — PWA & Cross-Cutting UI: As-Built PRD

> Reverse-engineered from implementation as of 2026-04-01. All facts derived from verified source files — no speculation.

---

## 1. The Goal

Provide the progressive web app shell, offline resilience, standard loading/error/empty states, first-session onboarding, a progress tracker for multi-step flows, and a persistent "This is not financial advice" disclaimer on every page. These are cross-cutting concerns that must be present across all pages and components — they are owned here but consumed everywhere.

---

## 2. The Problem It Solves

Without PWA support, users on mobile cannot install Rebalancify to their home screen and have a native-app-like experience. Without offline caching, a brief network loss interrupts the user's workflow with a broken page rather than showing last-known data. Without standardised loading/error/empty states, each page implements these inconsistently — some show spinners, some show blank space, some crash. Without the onboarding modal, new users arrive at an empty Overview with no guidance on what to do first.

---

## 3. The Proposed Solution / Underlying Concept

### PWA Configuration (STORY-027)

**next-pwa** is the integration point:
- `npm install next-pwa` — configured in `next.config.mjs`
- Service worker generated on `pnpm build` (disabled in dev, enabled in production)

**manifest.json** (`/public/manifest.json`):
```json
{
  "name": "Rebalancify",
  "short_name": "Rebalancify",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1E3A5F",
  "background_color": "#F8F9FA",
  "display": "standalone",
  "start_url": "/overview"
}
```

**Service worker caching strategy:**
- `NetworkFirst` for API calls (`GET /api/silos`, `GET /api/silos/:id/holdings`, `GET /api/news/portfolio`) — network preferred, cache fallback
- `CacheFirst` for static assets (JS bundles, CSS, images, fonts)

**OfflineBanner**: appears in the AppShell when `navigator.onLine = false`. Portfolio data shows from cache. Sync, Refresh, and Rebalance buttons are disabled with tooltip "Unavailable offline". A secondary label reads "Offline — showing data from [relative timestamp]".

**Lighthouse PWA audit**: ≥ 90 score on production URL.

### Onboarding Modal (STORY-028)

Appears exactly once — on first login after email verification when `user_profiles.onboarded = FALSE` and `active_silo_count = 0`.

**Flow:**
1. Modal shows 7 platform cards: Alpaca, BITKUB, InnovestX, Schwab, Webull, DIME, Other (enter manually)
2. User selects a card and clicks "Create silo" → `POST /api/silos` with pre-filled platform defaults
3. Modal closes → user navigated to `/silos/[new_silo_id]` → progress banner appears
4. "Skip for now" → modal closes → `user_profiles.onboarded = TRUE` set → user lands on Overview → no progress banner

After dismissal (skip or complete), the modal never appears again — tracked via `user_profiles.onboarded = TRUE`.

The modal is **non-dismissible**: no `onOpenChange` handler, clicking outside does nothing, Escape does nothing. Same rule as the `ConfirmDialog` in Component 3.

**DIME platform note**: DIME is permanently manual. The `PlatformBadge` for a DIME silo shows "DIME" (not "MANUAL") based on the silo `name` field. Only DIME gets this special badge; all other non-API platforms get the generic "MANUAL" badge.

### Progress Banner (STORY-028)

Shown when: `onboarded = TRUE` AND at least one silo exists AND that silo has zero holdings.

```
● Add holdings → ○ Set target weights → ○ Run first rebalance
```

Steps update reactively as the user completes them (filled circle when done). Dismissed via X button — dismissal stored server-side via `PATCH /api/profile` setting `progress_banner_dismissed = TRUE` (NOT localStorage, so it persists across devices). After dismissal, never shown again.

### Loading Skeleton Standardisation (STORY-029)

Every component that calls `useQuery` (TanStack Query) must render a `<LoadingSkeleton />` during the `isLoading` state. This is enforced by the STORY-029 grep audit:

```bash
grep -rn "useQuery" components/ --include="*.tsx"
# For each result: verify isLoading branch renders <LoadingSkeleton />
```

`LoadingSkeleton` is a shared component rendered by all data-fetching pages.

### Error Banner Standardisation (STORY-029)

Every component that calls `useQuery` must render `<ErrorBanner />` during the `isError` state. Same audit pattern as LoadingSkeleton.

`ErrorBanner` shows: error code, error message, and a retry button. The retry button re-runs the query.

### Empty State Standardisation (STORY-029)

Every list and table component must render `<EmptyState />` when data is an empty array. Audit: code review of all list components. `EmptyState` renders: an icon, a one-line description of what is missing, and a CTA button pointing to the action that would populate the list.

### "This is Not Financial Advice" Disclaimer

Rule 14 (CLAUDE.md): The disclaimer appears in the footer of every page. It is a single `<FooterDisclaimer />` component included in the root layout or AppShell. On the Research page specifically, `DisclaimerBanner` provides the persistent AI-specific disclaimer (non-collapsible, always visible above the content).

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| PWA installable | Chrome DevTools → Application → Manifest → "Install" button appears |
| Service worker registered | DevTools → Application → Service Workers → Rebalancify SW listed |
| Offline — cached data visible | DevTools → Network → Offline → page loads with last-known data |
| Offline — buttons disabled | DevTools offline → Sync/Refresh/Rebalance buttons show tooltip "Unavailable offline" |
| First offline load < 1s | DevTools → Throttling → Offline → measure from nav to content visible |
| Lighthouse PWA ≥ 90 | Lighthouse CI on Vercel production URL |
| Onboarding modal — shown once | Manual: create new account → modal appears → create silo → modal gone on next login |
| Onboarding modal — non-dismissible | ESC + backdrop click → modal stays open |
| Onboarding modal — skip | Click "Skip for now" → modal gone → Overview shown → not shown on refresh |
| Progress banner — reactive steps | Complete silo setup → add holdings → verify step 1 fills in |
| Progress banner — dismiss persists | Dismiss → hard refresh → banner not shown |
| LoadingSkeleton audit | `grep useQuery` → each has `isLoading` branch with `<LoadingSkeleton />` |
| ErrorBanner audit | `grep useQuery` → each has `isError` branch with `<ErrorBanner />` |
| EmptyState in all lists | Code review: all list components handle empty array |
| "not financial advice" per page | `grep -r "not financial advice" app/` → at least one hit per page |
| Onboarding — DIME badge | Create DIME silo → PlatformBadge shows "DIME" (not "MANUAL") |

---

## 5. Integration

### Shared Components (consumed across all components)

| Component | Where It's Used |
|---|---|
| `components/shared/OfflineBanner.tsx` | Mounted in AppShell (Component 1) |
| `components/shared/LoadingSkeleton.tsx` | All `useQuery` callsites |
| `components/shared/ErrorBanner.tsx` | All `useQuery` callsites |
| `components/shared/EmptyState.tsx` | All list/table components |
| `components/shared/OnboardingModal.tsx` | SessionContext gate in AppShell |
| `components/shared/ProgressBanner.tsx` | Overview page (shown conditionally) |
| `components/shared/FooterDisclaimer.tsx` | Root layout or AppShell footer |
| `components/shared/AlpacaLiveBadge.tsx` | Silo cards, rebalancing wizard |
| `components/shared/ConfirmDialog.tsx` | Destructive action confirmations |
| `components/shared/StalenessTag.tsx` | TopMoversTable when `stale: true` |
| `components/shared/AiInsightTag.tsx` | PeerCard (Component 7) |

### Consumed By

| Component | How It Uses These |
|---|---|
| **All components** | `LoadingSkeleton`, `ErrorBanner`, `EmptyState` in every data-fetching page |
| **Component 1 — Auth & Foundation** | `OfflineBanner` mounted in AppShell; `OnboardingModal` wired to SessionContext |
| **Component 2 — Portfolio Data Layer** | `ProgressBanner` on Overview when silo has no holdings |
| **Component 8 — AI Research Hub** | `DisclaimerBanner` on Research page; `FooterDisclaimer` in page footer |

### PWA Infrastructure

| File | Purpose |
|---|---|
| `next.config.mjs` | next-pwa configuration |
| `public/manifest.json` | PWA manifest |
| `public/icons/192.png` | PWA icon 192×192 |
| `public/icons/512.png` | PWA icon 512×512 |
| Service worker (generated) | Caches API responses (NetworkFirst) and static assets (CacheFirst) |

### External Dependencies

| Library | Purpose |
|---|---|
| `next-pwa` | Service worker generation, offline caching |
| TanStack Query | Powers `useQuery` calls that `LoadingSkeleton`/`ErrorBanner`/`EmptyState` wrap |

---

## 6. Sub-Components

| Sub-Component | File |
|---|---|
| PWA Configuration | `01_pwa_configuration.md` |
| Offline Banner | `02_offline_banner.md` |
| Onboarding Modal | `03_onboarding_modal.md` |
| Progress Banner | `04_progress_banner.md` |
| Loading Skeleton | `05_loading_skeleton.md` |
| Error Banner | `06_error_banner.md` |
| Empty State | `07_empty_state.md` |
| Footer Disclaimer | `08_footer_disclaimer.md` |
| PWA Service Worker | `09_pwa_service_worker.md` |
