# TS.3.3 — Allocation Guard

## Task
Implement regex-based scan blocking allocation percentage recommendations in LLM output.

## Target
`lib/allocationGuard.ts`

## Inputs
- `docs/architecture/components/08_ai_research_hub/06_allocation_guard.md`

## Process
1. Create `lib/allocationGuard.ts`:
   - `checkAllocationOutput(rawOutput: string): { safe: boolean, violation?: string }`
   - Regex pattern: `\d+\.?\d*\s*%` near allocation keywords: "allocate", "weight", "hold", "buy", "sell", "invest", "position"
   - Window: percentage within 50 characters of an allocation keyword
   - If detected: return `{ safe: false, violation: matched_text }`
   - **No false positives:** "P/E ratio is 25x" or "revenue grew 15%" must NOT trigger
2. Integration with research endpoint:
   - After LLM response, before storing: call `checkAllocationOutput()`
   - If unsafe: return HTTP 422 `LLM_ALLOCATION_OUTPUT` — do not store the session
   - Log the violation for prompt tuning
3. The system prompt also instructs the LLM not to recommend percentages (defense in depth)

## Outputs
- `lib/allocationGuard.ts`

## Verify
- "Allocate 25% to AAPL" → flagged (unsafe)
- "A company's P/E ratio is 25x" → NOT flagged (safe)
- "Revenue grew 15% year over year" → NOT flagged (safe)
- "Consider buying 30% of your portfolio in tech" → flagged (unsafe)

## Handoff
→ Sprint 4 (Research Hub UI)
