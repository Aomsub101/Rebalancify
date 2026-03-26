# STORY-033 — Research Hub UI & AI-Enriched Peer Cards (v2.0)

## AGENT CONTEXT

**What this file is:** A user story specification for the Research Hub UI — structured result cards (SentimentCard, RiskFactorsCard, NarrativeSummaryCard), persistent DisclaimerBanner, LLMKeyGate, and AiInsightTag on Discover peer cards. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R1 through F3-R7 (full AI Research Hub UI and disclaimer requirements)
**Connected to:** `docs/architecture/04-component-tree.md` (Research page components, AiInsightTag on PeerCard), `docs/design/03-screen-flows.md` (Research Hub layout), `CLAUDE.md` Rule 14 (disclaimer on every page)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-032
**Blocks:** Nothing — this closes Phase 8 and v2.0

---

## User Story

As a user with an LLM key configured, I can open the Research Hub for any asset and read a structured sentiment analysis, risk factors, and narrative summary. As a user on the Discover page, peer cards now show a brief AI-generated relationship insight.

---

## Acceptance Criteria

1. Research page at `/research/[ticker]` renders:
   - `DisclaimerBanner` (always visible, non-collapsible): "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions."
   - `LLMKeyGate` (if `llm_connected = false`): "To use the Research Hub, add your LLM API key in Settings." No research UI rendered behind this gate.
   - `ResearchHeader`: ticker symbol, company name, last refreshed timestamp.
   - `RefreshButton`: triggers a fresh LLM call (bypasses 24-hour cache).
   - `ResearchCards`: three cards rendered in order.
2. `SentimentCard`: coloured badge (bullish = positive, neutral = muted, bearish = negative) + confidence progress bar (0.0–1.0). Both colour and text label present (non-colour signal rule).
3. `RiskFactorsCard`: bulleted list. Minimum 2 items, maximum 8 items rendered. If LLM returns < 2 items, shows `ErrorBanner` with "Insufficient risk factors returned — try refreshing."
4. `NarrativeSummaryCard`: summary text (150–300 words). Expandable if truncated. Sources list at bottom (collapsible).
5. `DisclaimerBanner` is non-collapsible and always visible — verified: no close/dismiss button on this banner.
6. `RefreshButton` shows a loading spinner while the LLM call is in flight. Other page content remains interactive.
7. Discover page: `PeerCard` now shows `AiInsightTag` when `llm_connected = true`. Tag is max 12 words. Populated from `research_sessions` cached data — no additional LLM call triggered just for peer loading.
8. `AiInsightTag` is absent when `llm_connected = false` (the card renders without it). No empty placeholder shown.
9. Research page triggers can be: (a) navigating to `/research/[ticker]` directly, (b) clicking a holding's ticker in the silo detail page, (c) clicking a ticker in the Discover page.
10. The Research page footer shows the same "This is not financial advice." disclaimer as all other pages (CLAUDE.md Rule 14).

---

## Tasks

- [ ] Write `app/(dashboard)/research/[ticker]/page.tsx`
- [ ] Write `components/research/SentimentCard.tsx`
- [ ] Write `components/research/RiskFactorsCard.tsx`
- [ ] Write `components/research/NarrativeSummaryCard.tsx`
- [ ] Write `components/research/DisclaimerBanner.tsx` (non-collapsible)
- [ ] Write `components/research/LLMKeyGate.tsx`
- [ ] Update `components/silo/HoldingRow.tsx`: ticker becomes a link to `/research/[ticker]`
- [ ] Update `PeerCard`: render `AiInsightTag` when `llm_connected = true` and data available
- [ ] Write `components/shared/AiInsightTag.tsx`
- [ ] Test: `LLMKeyGate` blocks page when llm_connected = false
- [ ] Test: `DisclaimerBanner` has no dismiss/close button in DOM
- [ ] Test: refresh button does not block page during in-flight LLM call
- [ ] Test: AiInsightTag absent when llm_connected = false

---

## Post-Story Quality Checklist (v2.0 Closure)

Before marking this story done, run the full audit from STORY-029 plus:

- [ ] `grep -rn "AiInsightTag" components/` — should only appear in `PeerCard` and `AiInsightTag.tsx`
- [ ] `grep -rn "DisclaimerBanner" app/` — should appear on research page only (footer disclaimer is separate component)
- [ ] `grep -rn "not financial advice" app/` — at least one hit per page (footer) + research disclaimer
- [ ] No LLM provider URL appears in any client-side component (grep for `openai.com`, `anthropic.com`, `groq.com`, `deepseek.com`, `googleapis.com` in `app/(dashboard)/` → zero results)

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] Post-story quality checklist all passing
- [ ] DisclaimerBanner verified: no close/dismiss element in DOM (DevTools Elements inspection)
- [ ] Security test: zero browser requests to LLM provider domains
- [ ] `pnpm type-check` passes with zero errors
- [ ] Final v2.0 walkthrough: configure LLM key → open Research Hub → view results → Discover page shows AiInsightTag
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-033 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
