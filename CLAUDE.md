# CLAUDE.md — Rebalancify Master Agent Instructions

## AGENT CONTEXT

**What this file is:** The root-level master instruction file for all Claude Code agents working on this codebase. Read this file first in every session before touching any code.
**Derived from:** PRD_v1.3.md, TECH_DOCS_v1.2.md, design_preferences.md, FEATURES_v1.3.txt
**Connected to:** Every file in this repository. This is the source of truth for critical rules.
**Critical rules for agents using this file:**
- Read this entire file before writing a single line of code.
- If this file conflicts with any other file, this file wins — except for `docs/architecture/02-database-schema.md` on schema specifics.
- After every completed story, update `PROGRESS.md` to mark it done.

---

## 1. Project Identity

Rebalancify is a free, open-source, production-grade web application that gives self-directed retail investors a single decision-support hub for managing, analysing, and rebalancing multi-platform investment portfolios. It centralises holdings across disconnected platforms (Alpaca, BITKUB, InnovestX, Charles Schwab, Webull, DIME, and any manual platform), calculates deterministic buy/sell rebalancing orders based on user-defined target weights, and surfaces market news and asset discovery insights — leaving every allocation decision and trade execution strictly in the user's hands. It is not a robo-advisor, does not hold funds, and never recommends specific asset weights. Deployed free at a hosted URL; full source on GitHub; self-hostable without code changes.

---

## 2. Tech Stack

| Technology | Version | Role |
|---|---|---|
| Next.js | 15 | Full-stack framework — App Router, API Routes, SSR, PWA |
| React | 19 | UI component library |
| TypeScript | 5 | Type safety across the full stack |
| Tailwind CSS | 3 | Utility-first styling — the only styling method |
| shadcn/ui | latest | Component primitives (Dialog, Select, Tabs, etc.) |
| Supabase | latest SDK | PostgreSQL DB, Auth (email+password), pgvector (v2.0), Storage |
| TanStack Query | 5 | Server state management and cache invalidation |
| React Context | — | Global UI state (session, USD toggle, silo count) |
| Vercel | — | Zero-config deployment — free tier |
| Resend | — | Transactional email — daily drift digest — 3,000 emails/month free |
| Finnhub | — | Stock/ETF prices, news, peer data, company profiles |
| FMP | — | News fallback, fundamentals |
| CoinGecko | — | Crypto prices, Top Gainers/Losers |
| ExchangeRate-API | — | FX rates for USD conversion toggle — 60-min TTL |
| Alpaca | — | US stocks/ETFs — holdings fetch + order execution (v1.0) |
| BITKUB | — | Crypto exchange — holdings fetch (v1.0), execution (v2.0) |
| Settrade / InnovestX | — | Thai equities/digital assets — holdings fetch (v1.0), execution (v2.0) |
| Charles Schwab | — | US stocks/ETFs — holdings fetch (v1.0), execution (v2.0) |
| Webull | — | US/global stocks — holdings fetch (v1.0), execution (v2.0) |
| next-pwa | latest | Service worker, manifest.json, offline caching |
| Lucide React | latest | Icon set (ships with shadcn/ui) |
| Recharts | latest | Weight visualisation charts |
| Vitest | latest | Unit + integration test runner — runs `pnpm test` and `pnpm test:coverage` |
| Playwright | latest | E2E test runner — critical user flows only |
| Sonner | latest | Toast notification library — user feedback for all mutations |

---

## 3. Critical Rules — Never Violate

These rules are absolute. Violating any of them is a bug, not a style preference.

1. **No `<form>` tags.** Use `onClick` handlers and controlled inputs for all form interactions. This is required for PWA compatibility and avoids accidental browser form submission.

2. **All styling via Tailwind classes only.** No inline styles (`style={{}}`). No CSS Modules. No styled-components. No global CSS beyond `globals.css` for token definitions.

3. **All monetary values stored as `NUMERIC(20,8)` in PostgreSQL.** No `FLOAT`, no `REAL`, no JavaScript `number` arithmetic on monetary values. Use string representation in API responses (8 decimal places).

4. **All API keys (Alpaca, BITKUB, InnovestX, Schwab, Webull, LLM providers) must be encrypted before storage.** They must never appear in: API responses, browser console logs, URL parameters, error messages, or browser bundles. The encrypted value is stored in `user_profiles.*_enc` columns. The plaintext is decrypted server-side only, used once for the API call, and never returned.

5. **All calls to external APIs (brokerages, Finnhub, FMP, CoinGecko, ExchangeRate-API, LLM providers) must be proxied through Next.js API routes.** Never call these APIs directly from client components. The browser must never see API keys.

6. **The sidebar is always dark (`bg-sidebar`) regardless of system colour mode.** Do not override this with theme-conditional classes. The Tailwind class `bg-sidebar` resolves to `hsl(var(--sidebar-background))` — see `docs/design/05-theme-implementation.md`.

7. **Numeric table cells must use `text-right font-mono tabular-nums`.** This is a non-negotiable usability requirement for financial data alignment.

8. **The maximum active silo count is 5 per user.** Before any `INSERT` into `silos`, the API route must check `SELECT COUNT(*) FROM silos WHERE user_id = $1 AND is_active = TRUE`. If count >= 5, return HTTP 422 with `{ error: { code: "SILO_LIMIT_REACHED", message: "Maximum of 5 active silos reached" } }`.

9. **Rebalancing sessions are immutable after creation.** Never `UPDATE` a `rebalance_sessions` row after it is created. Each new rebalance is a new row. `snapshot_before` must be written on creation and never touched again. **Two permitted exceptions — both issued only by `POST /api/silos/:id/rebalance/execute`:** (1) `snapshot_after` may be populated after Alpaca execution completes. (2) `status` is transitioned from `'pending'` to `'approved'` / `'partial'` / `'cancelled'` per the state machine in `docs/architecture/02-database-schema.md`. No other column on `rebalance_sessions` may ever be updated. These exceptions are documented in `docs/prd/features/F1-rebalancing-engine.md` F1-R10.

10. **The ConfirmDialog for order execution must not be dismissible by clicking outside or pressing Escape.** The `<Dialog>` component must have no `onOpenChange` handler. The only way to close it is explicit Cancel or Confirm button press.

11. **Never store price history.** The `price_cache` table holds only the single most recent price per asset. Do not add time-series price columns or historical price tables.

12. **Weight percentages must be `NUMERIC(6,3)` in PostgreSQL.** Three decimal places: `14.820` not `14.82`. Display as `14.82%` (2dp) in the UI.

13. **All colour signals in the UI must have a secondary non-colour signal (icon or text).** A red drift badge must include a `<AlertCircle>` icon. A green status must include a checkmark or label. Colour-blind users must receive the same information.

14. **The disclaimer "This is not financial advice" must appear in the footer of every page and as a persistent label on all AI Research Hub outputs.**

15. **When Alpaca is in live trading mode, a persistent amber `LIVE` badge must appear on the silo card and at the top of the rebalancing wizard.** This cannot be hidden or toggled off by the user.

16. **API keys inputs must use `type="password"` with a show/hide toggle.** After saving, display only `••••••••`. Never render the key value again.

17. **The `formatNumber()` utility must be used for all numeric display.** Never format numbers inline. See `docs/design/CLAUDE_FRONTEND.md` for the complete formatting spec.

18. **RLS (Row Level Security) is required on every user-data table.** Verify that `SELECT COUNT(*) FROM silos WHERE id = $1` without a `WHERE user_id = auth.uid()` clause is blocked by the RLS policy. Run this check before marking any story complete.

19. **Asset ticker confirmation is done once per asset per silo.** Once an `asset_mapping` record exists for `(silo_id, asset_id)`, never prompt for confirmation again for that combination.

20. **The `ConfirmDialog` for destructive actions (Delete Silo, Delete Account) must use `variant="destructive"` for the confirm button and `variant="ghost"` for cancel.** Cancel is always left-aligned; Confirm is always right-aligned.

21. **One story per file — always.** Each story file must contain exactly one story. The filename must be `STORY-[NNN].md` where NNN matches exactly the story number inside. Files named with a range (e.g., `STORY-014-016.md`) are never permitted. When writing or generating stories, always create one file per story regardless of how small the story is.

22. **No story content overlap — ever.** A story's content must exist in exactly one file across the entire `stories/` directory. Before creating a new story file, verify with `grep -rn "^# STORY-NNN" stories/` that the story number does not already exist elsewhere. A story number appearing in two files simultaneously is a critical documentation bug that must be resolved before any development on that story begins.

23. **TDD order is mandatory for all `lib/` code.** Write the failing test first (Red), then write code to pass it (Green), then refactor. Never write implementation code in `lib/` before the test exists. See `docs/development/03-testing-strategy.md` TDD section for the full specification.

24. **Follow `DEVELOPMENT_LOOP.md` for every story.** The loop file is the single source of truth for how to start, implement, test, commit, and resume a story. If this file conflicts with instructions elsewhere, `DEVELOPMENT_LOOP.md` wins on process; `CLAUDE.md` wins on code rules.

---

## 4. Document Map

| Question | Where to look |
|---|---|
| What does this feature require? | `docs/prd/features/F[N]-*.md` |
| What does the database look like? | `docs/architecture/02-database-schema.md` |
| What endpoints exist? | `docs/architecture/03-api-contract.md` |
| What components exist and how do they nest? | `docs/architecture/04-component-tree.md` |
| In what order should I build things? | `docs/architecture/05-build-order.md` |
| What colour tokens do I use? | `docs/design/01-design-system.md` |
| How do I implement this component? | `docs/design/02-component-library.md` |
| How do I write frontend code correctly? | `docs/design/CLAUDE_FRONTEND.md` |
| What story am I implementing? | `stories/EPIC-[N]-*/STORY-[N].md` |
| What is complete and what is next? | `PROGRESS.md` |
| What security rules apply? | `docs/architecture/06-security-privacy.md` |
| How do I set up my dev environment? | `docs/development/01-dev-environment.md` |
| What are the coding standards? | `docs/development/02-coding-standards.md` |
| How do I add a new feature? | Section 7 of this file |
| What goes in globals.css and tailwind.config.ts? | `docs/design/05-theme-implementation.md` |
| What is the shadcn/ui token convention? | `docs/design/05-theme-implementation.md` |
| How do I run a story from start to finish? | `DEVELOPMENT_LOOP.md` |
| How do I resume after a session was interrupted? | `DEVELOPMENT_LOOP.md` Section 2 |
| What was built in previous stories? | `PROJECT_LOG.md` |
| What technical discoveries affect future work? | `PROJECT_LOG.md` — Architecture Decisions and Technical Debt sections |
| What does TDD mean for this project? | `docs/development/03-testing-strategy.md` TDD section |
| What CI/CD checks run on every push? | `docs/development/03-testing-strategy.md` CI/CD section |
| Which doc wins when two docs conflict? | `CONFLICT_RESOLVER.md` Section 1 — Authority Hierarchy |
| What do I do when a runtime error blocks me? | `CONFLICT_RESOLVER.md` Section 3 — Runtime Error Resolution |
| What are the mandatory session-end steps (bd dolt push)? | `AGENTS.md` — Session Completion section |
| What are the non-interactive shell command rules? | `AGENTS.md` — Non-Interactive Shell Commands section |

---

## 5. Current Build Phase

**Active Epic:** EPIC-02 — Silos & Holdings
**Active Story:** STORY-007 — Holdings CRUD (manual entry) + silo detail page
**Last Completed:** STORY-006 — Asset search + ticker mapping (2026-03-27)

Update this section manually as stories are completed. Format:
```
**Active Epic:** EPIC-[N] — [Name]
**Active Story:** STORY-[N] — [Title]
**Last Completed:** STORY-[N] — [Title] (YYYY-MM-DD)
```

---

## 5b. Task Tracking — Beads (bd)

All implementation task tracking uses both the Beads CLI (`bd`) and `PROGRESS.md`.
They are complementary: `bd` is machine-queryable and dependency-aware; `PROGRESS.md`
is the human-readable history. **Never create or update markdown task lists as a
substitute for bd commands.**

**At the start of every session:**
```bash
bd prime          # load current task state and context
bd ready          # see which tasks are immediately unblocked
```

**During work:**
```bash
bd update <id> --claim       # claim a task before beginning it
bd close <id> "<note>"       # close a task when done (in addition to PROGRESS.md update)
bd dep add <child> <parent>  # register any newly discovered dependency
```

**When creating new tasks (post-v2.0 features only):**
```bash
bd create "<STORY-NNN: title>" -p <0|1|2>    # never use markdown lists
bd dep add <new-task-id> <parent-epic-id>
```

**Stop and ask the human before:**
- Closing a task you did not open in this session
- Creating more than 5 tasks at once
- Modifying priorities on existing tasks

**Relationship with PROGRESS.md:**
`bd close` and PROGRESS.md update happen in the same step (Step 7 of DEVELOPMENT_LOOP.md).
If they disagree, `bd status` is authoritative for dependency resolution;
PROGRESS.md is authoritative for human-readable history.

## 6. Forbidden Patterns

These are code anti-patterns specific to Rebalancify. If you see one in existing code, flag it as a bug.

| Pattern | Why Forbidden | Correct Alternative |
|---|---|---|
| `<form onSubmit={...}>` | Causes accidental browser form submit; breaks PWA | `onClick` on button + controlled state |
| `style={{ color: 'red' }}` | Bypasses design system | `className="text-negative"` |
| `Number(price) * Number(quantity)` | Floating-point error on monetary values | Use string arithmetic or a decimal library |
| `console.log(apiKey)` | Exposes secrets | Never log keys; log only redacted IDs |
| `fetch('https://finnhub.io/...')` in client component | Exposes API key | Call `/api/prices/...` (Next.js route) |
| `UPDATE rebalance_sessions SET ...` | Breaks immutability | Insert a new session |
| `const [silo1, silo2] = silos` | Hardcodes silo count | Always use `.map()` |
| `useEffect` for data fetching | Bypasses React Query cache | Use `useQuery` from TanStack Query |
| `Math.random()` for IDs | Non-deterministic | Use `crypto.randomUUID()` or Supabase `gen_random_uuid()` |
| `outline-none` without `focus-visible:ring` | Breaks keyboard accessibility | Always pair: `outline-none focus-visible:ring-2 focus-visible:ring-ring` |
| `rounded-full` on buttons | Wrong brand tone | `rounded-md` |
| Hard-coded currency symbol `$` | Breaks multi-currency | Use `formatNumber(value, currency)` utility |

---

## 7. How to Add a New Feature

When adding a feature post-v2.0, follow this exact sequence. Do not skip steps.

1. **Read `stories/STORY-TEMPLATE.md`** — understand the template before writing anything.
2. **Create `docs/prd/features/F[N]-[feature-name].md`** — full requirement specification using the PRD feature spec format. Every requirement must have an ID (e.g., F6-R1).
3. **Update `docs/architecture/02-database-schema.md`** — add new tables or columns if required. Follow the existing SQL format. Run migrations before writing application code.
4. **Update `docs/architecture/03-api-contract.md`** — document all new endpoints with request/response shapes.
5. **Update `docs/architecture/04-component-tree.md`** — add new components to the tree.
6. **Update `docs/architecture/05-build-order.md`** — add a new Phase or extend an existing phase with the new tasks.
7. **Update `docs/design/02-component-library.md`** — add component patterns if new components are required.
8. **Update `docs/design/03-screen-flows.md`** — add the new page layout diagram.
9. **Update `stories/epics.md`** — add a new epic entry with status `planned`.
10. **Create `stories/EPIC-[N]-[name]/`** directory.
11. **Create at least one story file** using `stories/STORY-TEMPLATE.md` as the template.
12. **Update `CLAUDE.md`** (this file) if the feature introduces new critical rules.
13. **Update `PROGRESS.md`** — add the new epic to the build tracker.
14. **Begin implementation** only after all above steps are complete and consistent.
