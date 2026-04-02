# TS.3.4 — Footer Disclaimer

## Task
Create "This is not financial advice" footer disclaimer on every page.

## Target
`components/shared/FooterDisclaimer.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/08_footer_disclaimer.md`

## Process
1. Create `components/shared/FooterDisclaimer.tsx`:
   - Text: "This is not financial advice. All investment decisions are your own."
   - Muted text, small font, centered
   - Always visible at bottom of page content
2. Mount in AppShell (root layout or dashboard layout footer area)
3. This satisfies Rule 14 (CLAUDE.md) for per-page disclaimer
4. On Research page, DisclaimerBanner (Component 08) provides the AI-specific disclaimer

## Outputs
- `components/shared/FooterDisclaimer.tsx`
- Updated layout to include footer

## Verify
- `grep -r "not financial advice" app/` → at least one hit per page
- Footer visible on every dashboard page
- Does not interfere with content layout

## Handoff
→ Sprint 4 (Audits + Testing)
