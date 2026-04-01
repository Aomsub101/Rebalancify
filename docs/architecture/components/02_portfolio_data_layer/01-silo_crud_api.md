# Sub-Component: Silo CRUD API

## 1. The Goal

Provide the authoritative REST endpoints for creating, reading, updating, and soft-deleting investment silos — the core data model representing a user's portfolio on a single platform. Enforce the maximum-5-silos rule at the API boundary and compute per-silo total value from holdings + cash balance.

---

## 2. The Problem It Solves

Every other feature — holdings management, rebalancing, drift calculation — is scoped to a specific silo. Without a central silo CRUD layer with enforced limits, the rest of the application cannot reliably manage multi-platform portfolios. The soft-delete pattern is required to preserve rebalance history (hard deletes would break audit trails).

---

## 3. The Proposed Solution / Underlying Concept

### Database Table: `silos`

```sql
silos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  name TEXT NOT NULL,
  platform_type TEXT NOT NULL,   -- 'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'
  base_currency TEXT NOT NULL DEFAULT 'USD',
  drift_threshold NUMERIC(6,3) DEFAULT 5.0,
  cash_balance NUMERIC(20,8) DEFAULT '0.00000000',
  alpaca_mode TEXT DEFAULT 'paper',  -- 'paper' | 'live'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
-- RLS: users can only SELECT/DELETE their own silos
```

### API Endpoints

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/silos` | Returns all active silos for the authenticated user |
| `POST` | `/api/silos` | Creates a new silo (enforces 5-limit) |
| `PATCH` | `/api/silos/:id` | Updates silo name, `drift_threshold` |
| `DELETE` | `/api/silos/:id` | Soft-delete (`is_active = FALSE`) |

### GET /api/silos

- Uses `createServerClient` to get the authenticated user
- Queries `silos` filtered by `user_id` and `is_active = TRUE`
- Fetches `alpaca_mode` from `user_profiles` to know whether Alpaca is in live mode
- For each silo, computes `total_value` by summing `holdings` quantities × cached prices + `cash_balance`
- Returns: array of silo objects each including `total_value`, `active_silo_count`, `silo_limit: 5`

### POST /api/silos

```typescript
// Enforced check before INSERT (CLAUDE.md Rule 8)
const limitReached = await checkSiloLimit(supabase, user.id)
if (limitReached) {
  return NextResponse.json(
    { error: { code: 'SILO_LIMIT_REACHED', message: 'Maximum of 5 active silos reached' } },
    { status: 422 }
  )
}
```

Validates:
- `name` is a non-empty string
- `platform_type` is one of the 6 valid types
- `base_currency` is a 3-letter code (default: `USD`)
- `drift_threshold` is a number (default: `5.0`)
- `cash_balance` is a numeric string (default: `'0.00000000'`)

### DELETE /api/silos/:id

Soft-delete — sets `is_active = FALSE`. Never hard-deletes. This preserves `rebalance_sessions` history and allows the user to theoretically "undelete" in future if needed.

### `buildSiloResponse` Utility

A shared function that transforms a raw DB silo row into the API response shape:
```typescript
buildSiloResponse(silo, activeCount, limit, alpacaMode)
// Returns: { id, name, platform_type, base_currency, drift_threshold,
//             total_value, last_synced_at, active_silo_count, silo_limit, alpaca_mode }
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| `POST` at 5 silos returns 422 | Unit test with mocked DB count = 5 |
| `DELETE` sets `is_active = FALSE` | Direct DB check after DELETE call |
| Total value = holdings sum + cash_balance | Unit test with known quantities and prices |
| RLS blocks cross-user access | Two-user test: User B's token cannot SELECT User A's silo |
| Valid `platform_type` required | POST with invalid type → HTTP 400 |
| `pnpm test` | `app/api/silos/__tests__/route.test.ts` passes |
