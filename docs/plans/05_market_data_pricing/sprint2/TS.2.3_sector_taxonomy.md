# TS.2.3 — Sector Taxonomy

## Task
Maintain and validate the static sector_taxonomy.json used as peer discovery fallback.

## Target
`sector_taxonomy.json` (project root)

## Inputs
- `docs/architecture/components/05_market_data_pricing/05-sector_taxonomy.md`

## Process
1. Verify `sector_taxonomy.json` contains 8+ sectors with representative tickers:
   - Technology, Finance, Healthcare, ConsumerDiscretionary, ConsumerStaples
   - Energy, Industrials, Utilities, Materials, RealEstate, CommunicationServices, Crypto
2. Each sector: array of tickers (110+ total)
3. Used by `GET /api/assets/:id/peers` as fallback when Finnhub `/stock/peers` unavailable
4. Enables offline PWA functionality for the Discover page
5. Create TypeScript type for the taxonomy shape
6. Create utility function to look up peers by sector

## Outputs
- Validated `sector_taxonomy.json`
- `lib/sectorTaxonomy.ts` (type + lookup utility)

## Verify
- JSON is valid, all sectors populated
- Lookup function returns correct peers for a given ticker's sector
- At least 5 tickers per sector

## Handoff
→ Sprint 3 (Testing)
