# Sub-Component: FX Rates & USD Toggle

## 1. The Goal

Enable multi-currency portfolio display by providing live USD conversion rates, with a 60-minute cache TTL to avoid hammering the ExchangeRate-API. The USD toggle in the TopBar lets users switch between native-currency and USD-denominated views without any database writes.

---

## 2. The Problem It Solves

A user with a BITKUB silo (THB base currency) and an Alpaca silo (USD) needs to see a meaningful aggregate total. Without FX rates, the app would either show incompatible currencies or default to an arbitrary conversion. The USD toggle lets Thai Baht users view everything in dollars for international comparison.

---

## 3. The Proposed Solution / Underlying Concept

### Database Table: `fx_rates`

```sql
fx_rates (
  currency TEXT PRIMARY KEY,     -- e.g. 'THB'
  rate_to_usd TEXT NOT NULL,     -- e.g. '0.0295' (8dp string)
  fetched_at TIMESTAMPTZ NOT NULL
)
-- Read-all RLS: all authenticated users can read (not user-scoped)
```

### GET /api/fx-rates

**Cache TTL: 60 minutes**

```typescript
function isStale(row: FxRateRow): boolean {
  const ageMs = Date.now() - new Date(row.fetched_at).getTime()
  return ageMs > 60 * 60 * 1000
}
```

**Refresh logic:**
1. Determine which currencies the user's silos need (`USD` always included)
2. Fetch cached rows from `fx_rates` for those currencies
3. If any currency is missing OR stale → call ExchangeRate-API and upsert
4. Return cached rates (either fresh, or stale fallback after API failure)

**Graceful degradation:** If ExchangeRate-API is unavailable, the endpoint logs the error and returns whatever is in `fx_rates` — even if stale. The client never sees an error.

### USD Toggle in TopBar (`TopBar.tsx`)

```typescript
// Fetch FX rates only on Overview page (AC-8)
const { data: fxRatesData } = useQuery({
  queryKey: ['fx-rates'],
  queryFn: fetchFxRates,
  enabled: !!session && isOverview,
})

const fxAvailable = isOverview && !fxRatesError && fxRates !== null

// Toggle disabled (greyed out) when fxRates unavailable
<button disabled={!fxAvailable} aria-pressed={showUSD}>
```

On toggle: `PATCH /api/profile` with `{ show_usd_toggle: boolean }` persists the preference to `user_profiles.show_usd_toggle`.

### SiloCard USD Display

```typescript
const useConvertedUSD = showUSD && usdRate !== undefined
const displayValue = useConvertedUSD ? rawValue * usdRate : rawValue
const displayCurrency = useConvertedUSD ? 'USD' : silo.base_currency
```

**Display only — no DB writes when USD mode is on.**

### Supported Currencies

All currencies present in any of the user's active silos are fetched. `USD` is always included as the base reference. The ExchangeRate-API call uses `?base=USD` and returns rates for all supported currencies.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Second call within 60 min → no API call | Mock ExchangeRate-API; call twice in 30 min → 1 request |
| Stale cache triggers refresh | Manipulate `fetched_at` to 61 min ago → ExchangeRate-API called |
| API failure → cached rates returned | Block ExchangeRate-API → response still 200 with stale data |
| Toggle persists across page refresh | Toggle on → hard refresh → toggle still on |
| Toggle disabled when FX unavailable | Simulate fx_rates query failure → button greyed out |
| `pnpm test` | `app/api/fx-rates/__tests__/route.test.ts` passes |
