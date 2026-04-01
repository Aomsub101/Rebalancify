# Sub-Component: Holdings API

## 1. The Goal

Provide CRUD endpoints for managing individual asset positions within a silo — quantity, cost basis, and associated asset — while enforcing that price data always comes from the cache and never from user input.

---

## 2. The Problem It Solves

Investors add, adjust, and remove holdings as they buy and sell. The holdings layer must: (a) ignore any price supplied by the user (preventing stale/manipulated prices from entering the system), (b) flag stale holdings that haven't been updated in over 7 days, and (c) compute per-holding value reactively as prices update.

---

## 3. The Proposed Solution / Underlying Concept

### Database Table: `holdings`

```sql
holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id UUID NOT NULL REFERENCES silos(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  quantity NUMERIC(20,8) NOT NULL,
  cost_basis NUMERIC(20,8),      -- per-unit cost basis in silo base_currency
  last_price_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
-- RLS: users can only access holdings in silos they own
```

### API Endpoints

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/silos/:id/holdings` | Returns all holdings with derived fields |
| `POST` | `/api/silos/:id/holdings` | Create holding (price ignored — from cache) |
| `PATCH` | `/api/silos/:id/holdings/:id` | Update `quantity` or `cost_basis` |

### GET /api/silos/:id/holdings

Returns holdings joined with `assets` (ticker, name, type) and enriched with:
- `current_price` — from `price_cache`
- `current_value` — `quantity × current_price`
- `weight_pct` — `(current_value / silo_total_value) × 100`
- `drift` — `weight_pct - target_weight_pct`
- `stale_days` — days since `last_price_refreshed_at`
- `StalenessTag` rendered when `stale_days > 7`

### POST /api/silos/:id/holdings — Price Ignored Rule

```typescript
// CLAUDE.md Rule: price in request body is IGNORED
// Price always sourced from price_cache
const { price, ...rest } = body
// ... rest is validated and inserted
```

On insert, `last_price_refreshed_at` is set to `now()` and `priceService.ts` is called to ensure the price is in the cache for downstream calculations.

### Inline Editing Pattern

The silo detail page uses optimistic TanStack Query updates for inline quantity/cost_basis edits:
1. User edits field → `useMutation` fires immediately
2. `queryClient.setQueryData` updates the cache optimistically
3. On error, `queryClient.invalidateQueries` reverts to server state

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Price ignored on POST | POST with `{ price: 999 }` → holding created with cached price |
| Stale flag at 7+ days | Set `last_price_refreshed_at` to 8 days ago → `StalenessTag` shown |
| Inline edit optimistic update | Edit quantity → UI updates before server response |
| RLS isolation | User B cannot access User A's holdings via direct API call |
| `pnpm test` | `app/api/silos/[silo_id]/holdings/__tests__/route.test.ts` passes |
