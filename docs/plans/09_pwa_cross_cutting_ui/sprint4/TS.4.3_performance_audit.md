# TS.4.3 — Performance Audit

## Task
Run Lighthouse PWA audit and verify NFR performance targets.

## Target
Production Vercel URL

## Process
1. **Lighthouse PWA audit:** Target ≥ 90 score
   - Run on production URL (not localhost)
   - Fix any PWA compliance issues
2. **Performance targets:**
   - Rebalance calculation: < 2 seconds
   - News page load: < 3 seconds
   - First page load: < 3 seconds
   - PWA offline first load: < 1 second
3. Optimize if any target missed:
   - Bundle size analysis (`pnpm analyze`)
   - Image optimization
   - Code splitting for heavy routes (research page)
   - TanStack Query staleTime tuning

## Outputs
- Lighthouse report (screenshot/PDF)
- Performance optimization changes if needed

## Verify
- Lighthouse PWA ≥ 90
- All performance targets met
- Bundle size reasonable

## Handoff
→ TS.4.4 (E2E tests)
