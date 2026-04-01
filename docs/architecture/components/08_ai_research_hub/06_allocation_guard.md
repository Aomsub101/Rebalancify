# Sub-Component: Allocation Guard

## 1. The Goal

Scan the raw LLM output before returning it to the client. If the LLM has recommended a specific portfolio allocation percentage for any asset — even subtly — the response is rejected with HTTP 422 and the code `LLM_ALLOCATION_OUTPUT`. This protects the platform from giving financial advice that could create legal liability.

---

## 2. The Problem It Solves

LLMs are prone to generating allocation recommendations (e.g., "Allocate 30% to bonds and 70% to equities") especially when prompted to give financial guidance. Even if the system prompt explicitly forbids it, the model may still slip in a percentage near allocation language. A regex-based post-processing guard catches these before they reach the user.

---

## 3. The Proposed Solution / Underlying Concept

### Detection Logic

The guard scans for a percentage sign (`%`) appearing near allocation language keywords.

**Keywords**: `allocate`, `weight`, `hold`, `buy`, `sell`, `portfolio`, `position`, `exposure`, `invest`

**Regex pattern**: `\d+\.?\d*\s*%` within a 50-character window of any keyword.

**Examples flagged**:
- "Allocate 25% to AAPL"
- "You should weight 40% bonds"
- "Hold 15% in cash"
- "Buy 30% of your portfolio in NVDA"

**Examples NOT flagged**:
- "A company's P/E ratio is 25x" (no allocation keyword nearby)
- "MSFT is up 3.5% today" (no allocation keyword nearby)
- "Quarterly revenue grew 12%" (no allocation keyword nearby)

### Response on Detection

```json
// HTTP 422 Unprocessable Entity
{
  "error": {
    "code": "LLM_ALLOCATION_OUTPUT",
    "message": "The model output contained an allocation recommendation. Please try again."
  }
}
```

A new `research_sessions` row is NOT inserted when the guard triggers — the attempt is rejected.

### Placement

The guard is applied in `POST /api/research/:ticker` after receiving the raw LLM output but before parsing it into structured output and inserting the `research_sessions` row.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| "Allocate 25% to AAPL" → 422 | Unit: inject LLM output with phrase → assert HTTP 422 |
| "A company's P/E ratio is 25x" → NOT flagged | Unit: inject sentence → assert HTTP 200 |
| "MSFT is up 3.5% today" → NOT flagged | Unit: inject sentence → assert HTTP 200 |
| No false positives on real research output | Integration: research 5 different tickers → all pass |
| Guard fires before row insert | Unit: detect 422 → verify no `research_sessions` row inserted |
