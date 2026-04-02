# TS.4.1 — Unit Tests

## Task
Write unit tests for deduplication, two-tier filtering, and pagination.

## Target
`tests/unit/`

## Process
1. `tests/unit/news-dedup.test.ts`: duplicate externalId → one article kept
2. `tests/unit/news-tiers.test.ts`: tier-1 (direct ticker overlap) ranks higher than tier-2 (metadata overlap)
3. `tests/unit/news-pagination.test.ts`: correct slicing for page 1, 2, edge cases
4. `tests/unit/news-parse.test.ts`: Finnhub and FMP article parsing, null handling

## Outputs
- `tests/unit/news-dedup.test.ts`
- `tests/unit/news-tiers.test.ts`
- `tests/unit/news-pagination.test.ts`
- `tests/unit/news-parse.test.ts`

## Verify
- `pnpm test` — all pass

## Handoff
→ TS.4.2 (Integration tests)
