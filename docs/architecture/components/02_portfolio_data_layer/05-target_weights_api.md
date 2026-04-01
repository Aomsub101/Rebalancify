# Sub-Component: Target Weights API

## 1. The Goal

Allow users to set and update target weight percentages for each asset in a silo. Weights do not need to sum to 100% — the remainder is treated as an implicit cash target. All weight operations are atomic to prevent partial-update race conditions.

---

## 2. The Problem It Solves

Users change their investment thesis over time. The target weights layer must support atomic replacement (not individual upserts) so that a mid-edit navigation doesn't leave the weights table in a half-updated state. The cash-target remainder concept means users don't have to manually account for unallocated percentage.

---

## 3. The Proposed Solution / Underlying Concept

### Database Table: `target_weights`

```sql
target_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id UUID NOT NULL REFERENCES silos(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  weight_pct NUMERIC(6,3) NOT NULL,   -- e.g. 14.820
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(silo_id, asset_id)
)
-- RLS: users can only access weights in silos they own
```

### API Endpoints

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/silos/:id/target-weights` | Returns all weight rows for the silo |
| `PUT` | `/api/silos/:id/target-weights` | Atomically replace all weights |

### PUT /api/silos/:id/target-weights — Atomic Replace

```typescript
// All existing weights for this silo are deleted and replaced in one transaction
await supabase.from('target_weights').delete().eq('silo_id', siloId)
await supabase.from('target_weights').insert(newWeights)
```

**Response includes derived values:**

```typescript
{
  weights_sum_pct: number,     // SUM of all weight_pct values
  cash_target_pct: number,     // 100 - weights_sum_pct
  sum_warning: boolean,        // true if weights_sum_pct != 100
}
```

`sum_warning` is `true` when weights don't add up to 100% — alerting the user that their targets imply a cash position they may not have intended.

### Weight Input — 3 Decimal Places

Stored as `NUMERIC(6,3)` in PostgreSQL (e.g., `14.820`). Displayed in the UI as `14.82%` (2dp). Input fields use `weight-input` format via `formatNumber()` (3dp, no grouping separator) to allow precise entry.

### Dirty Guard (`useDirtyGuard` Hook)

When the user has edited target weights without saving, `beforeunload` fires on tab close or navigation attempt, prompting the user to confirm they want to abandon changes.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| PUT replaces all weights | PUT [A:20%, B:30%] then PUT [A:15%] → only A:15% remains |
| `weights_sum_pct` correct | Two assets at 40% and 30% → `weights_sum_pct = 70.000` |
| `cash_target_pct` = 100 - sum | weights_sum=70 → cash_target=30 |
| `sum_warning` true when ≠ 100 | PUT 40% + 40% → `sum_warning = true` |
| Dirty guard fires | Edit weight → click browser back → `beforeunload` dialog |
| `pnpm test` | `app/api/silos/[silo_id]/target-weights/__tests__/route.test.ts` passes |
