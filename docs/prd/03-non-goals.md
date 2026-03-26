# docs/prd/03-non-goals.md — Non-Goals (Explicit Out of Scope)

## AGENT CONTEXT

**What this file is:** The definitive list of what Rebalancify does NOT do in v1.0 and why. Use this to reject scope creep.
**Derived from:** PRD_v1.3.md Section 3
**Connected to:** docs/prd/00-executive-summary.md, CLAUDE.md (critical rules)
**Critical rules for agents using this file:**
- If a feature request contradicts this list, refuse it and reference the specific non-goal.
- Non-goals for v1.0 may become v2.0 or v3.0 scope — check the roadmap before assuming permanence.

---

## v1.0 Non-Goals

| Out of Scope | Rationale | Future Version? |
|---|---|---|
| The app holds or custodies user funds | Calculation and display tool only. Money stays on the user's brokerage. | Never |
| Tax-lot tracking or tax optimisation | Regulatory complexity across jurisdictions. | v3.0+ |
| Options, futures, derivatives | Equity and crypto only in v1.0. | v3.0+ |
| Non-US, non-crypto stock exchanges (SET, LSE, etc.) | API complexity; deferred to allow focus on core use case. | v2.0+ |
| AI recommending specific target weight percentages | Regulatory risk. AI outputs sentiment and risk factors only — never allocation percentages. | Never (regulatory red line) |
| Executing trades without explicit user approval | Autonomy core value. All execution requires a manual confirmation step. | Never |
| Native iOS or Android app | PWA covers mobile in v1.0. | v3.0+ |
| Multi-user / shared account management | Single-user model only. | v3.0+ |
| Live price alert push notifications | Daily digest only. Real-time alerting requires a paid service. | v2.0+ |
| Manual entry of asset prices by the user | Prices always fetched automatically. Prevents stale-price calculation errors. | Never |
| Historical price storage | Rebalancify is a rebalancing tool, not a charting tool. | Never |
| Automated execution for BITKUB, InnovestX, Schwab, Webull | Deferred to v2.0. Holdings fetch in v1.0; execution in v2.0. | v2.0 |
| Plugin architecture for platforms without APIs | Defined as a contribution path for future contributors. Not shipped in v1.0 or v2.0. | Community |
| Background auto-refresh of news | User-triggered refresh only. Prevents quota exhaustion on free-tier APIs. | Never (design decision) |
| Ads or sponsored content | Conflicts with transparency and user autonomy core values. | Never |
| Scheduled automated rebalancing | Freemium feature candidate (self-hosted unlimited; hosted Pro tier). | Freemium v3.0+ |

---

## Design Anti-Goals

These are UX/design decisions that must not be made, even if technically feasible:

| Anti-Goal | Why |
|---|---|
| Emoji or celebratory language in UI copy | Wrong brand tone — professional instrument, not a consumer app |
| Animations that exist purely for delight | Inappropriate for the product's tone; see `docs/design/04-ux-patterns.md` |
| AI outputs without disclaimers | Regulatory requirement — all AI surfaces must carry the financial advice disclaimer |
| Hiding the silo limit from users | Must always be visible: sidebar badge, Settings usage bar |
| Auto-submitting any form | Requires affirmative user action for all consequential operations |
