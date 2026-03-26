# docs/prd/04-non-functional-requirements.md — Non-Functional Requirements

## AGENT CONTEXT

**What this file is:** Measurable performance, availability, security, and browser support requirements. These are verified in STORY-029 (performance audit) and throughout all stories via the Definition of Done.
**Derived from:** PRD_v1.3.md Section 8
**Connected to:** stories/EPIC-08-pwa-polish/STORY-029.md, docs/architecture/06-security-privacy.md, CLAUDE.md (critical rules 1–20)
**Critical rules for agents using this file:**
- Every NFR is a testable constraint, not a goal. "Under 2 seconds" means a failing test if exceeded.
- Security NFRs are enforced in every story's Definition of Done — not just STORY-029.

---

## 8.1 Performance

| Metric | Target | How Measured |
|---|---|---|
| Rebalancing calculation render time | < 2 seconds for portfolios up to 50 holdings | Measure from `POST /rebalance/calculate` request to orders table rendered |
| News feed refresh time | < 3 seconds per tab | Measure from refresh button click to articles rendered |
| Price cache TTL | 15 min (stocks + crypto); 60 min (FX rates) | Check `price_cache.fetched_at` age before re-fetch |
| Page first load (broadband) | < 3 seconds | Lighthouse performance audit; measure Time to Interactive |
| PWA offline load (cached state) | < 1 second | Measure with network disabled in DevTools after first load |
| Order confirmation dialog | Synchronous — no background delay | ConfirmDialog must be visible immediately on button click |

---

## 8.2 Availability & Offline

**PWA requirement:** After first load, the following features must function without internet connection:
- Portfolio view (last-known holdings and prices from cache)
- Rebalancing calculator (using last-known state — no live price fetch)
- Drift indicator (using last-known drift snapshot)

**Offline indicators:** Features unavailable offline (live prices, news, order execution) must display an `OfflineBanner` component — not an error state. The distinction: "Offline" is a graceful informational state; an error means something went wrong when connectivity exists.

**External API failure behaviour:**

| Dependency | Failure Behaviour |
|---|---|
| Finnhub | Show last cached data + timestamp + direct source link |
| FMP | Fall back to Finnhub-only; show "FMP unavailable" notice |
| CoinGecko | Show last cached data + stale timestamp |
| ExchangeRate-API | Disable USD toggle; show "FX data unavailable" |
| Alpaca | Show "Broker connection unavailable"; calculator works with last state |
| BITKUB / InnovestX / Schwab / Webull | Show "Exchange connection unavailable"; manual entry still works |
| Supabase | Full service degradation; show maintenance page |
| Resend | Skip email delivery; in-app notification still fires |

---

## 8.3 Security

See `docs/architecture/06-security-privacy.md` for the full security specification. Summary:

- All API keys encrypted at rest in Supabase (`user_profiles.*_enc`). Never in logs, URL parameters, or error messages.
- All brokerage and LLM calls proxied through Next.js API routes. Keys never exposed to browser.
- Auth: Supabase Auth email + password. Password reset via email link only.
- RLS enforced on every user-data table. Verified for every story touching the database.

---

## 8.4 Browser & Device Support

| Environment | Support Level |
|---|---|
| Chrome (latest 2 versions) | Full |
| Safari (latest 2 versions) | Full |
| Firefox (latest 2 versions) | Full |
| Mobile — iOS Safari | Full (PWA installable) |
| Mobile — Android Chrome | Full (PWA installable) |
| Internet Explorer (all versions) | None — not supported |

**Minimum viewport:** 375px (iPhone SE). All UI must be usable at this width.
**Desktop target:** 1280px+ for optimal table display.

**PWA installability requirements:**
- `manifest.json` with correct icons, `theme_color`, `background_color`
- Service worker registered via `next-pwa`
- HTTPS in production (Vercel provides this automatically)
- At least one offline-capable route
