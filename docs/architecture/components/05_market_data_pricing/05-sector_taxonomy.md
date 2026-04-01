# 05 — sector_taxonomy.json

## The Goal

Provide a static, hardcoded list of peer tickers per sector that the Asset Discovery component can fall back to when Finnhub's `/stock/peers` endpoint is unavailable or returns an empty result.

---

## The Problem It Solves

Finnhub's peer discovery (`GET /stock/peers?symbol=<ticker>`) identifies related companies by institutional ownership patterns. If Finnhub is rate-limited or a ticker is not in Finnhub's database, returning an empty peers list would leave the Discovery page with no content. The static taxonomy provides a deterministic fallback that is always available and requires zero external API calls.

---

## The Proposed Solution

A static JSON file distributed at the project root (`sector_taxonomy.json`) maps 11 sector names to arrays of representative tickers. Each sector contains 10–12 tickers of well-known, widely-held stocks or crypto assets. This is a **manual, static** file — it is not fetched from any API and must be updated by hand as the portfolio grows.

### Schema

```json
{
  "_comment": "Static peer fallback when Finnhub is unavailable",
  "_schema": "{ [sector: string]: string[] }",
  "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "TSLA", "AMZN", "AMD", "INTC", "CRM"],
  "Finance": ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "V", "MA"],
  "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY", "LLY"],
  "ConsumerDiscretionary": ["HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "BKNG", "CMG", "YUM", "DPZ"],
  "ConsumerStaples": ["WMT", "PG", "KO", "PEP", "COST", "PM", "MO", "CL", "GIS", "K"],
  "Energy": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "VLO", "OXY", "PSX", "DVN"],
  "Industrials": ["HON", "UPS", "CAT", "DE", "GE", "MMM", "RTX", "LMT", "NOC", "BA"],
  "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "PCG", "ED", "XEL"],
  "Materials": ["LIN", "APD", "ECL", "SHW", "FCX", "NEM", "NUE", "VMC", "MLM", "ALB"],
  "RealEstate": ["AMT", "PLD", "CCI", "EQIX", "PSA", "DLR", "O", "WELL", "SPG", "AVB"],
  "CommunicationServices": ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "VZ", "T", "TMUS", "EA", "TTWO"],
  "Crypto": ["BTC", "ETH", "BNB", "SOL", "ADA", "DOGE", "XRP", "DOT", "AVAX", "MATIC"]
}
```

### Usage in Asset Discovery

Asset Discovery (Component 7) looks up the asset's `sector` field, then returns the corresponding ticker array from `sector_taxonomy.json` **excluding the queried ticker itself**. This gives a list of peers in the same sector.

---

## Limitations

- Not a substitute for Finnhub's institutional-ownership-based peer detection
- Manual maintenance required — missing tickers won't appear automatically
- Does not include international equities (Thai stocks, emerging markets, etc.)

---

## Testing & Verification

| Check | Method |
|---|---|
| File is valid JSON | Manual: parse `sector_taxonomy.json` → no error |
| Queried ticker excluded from results | Manual: query peers for AAPL → result includes MSFT but not AAPL |
| All sectors represented | Manual: verify all 11 sector keys present |
| File imported by Discovery route | Code review: verify import path matches file location |
