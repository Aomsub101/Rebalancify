# Sub-Component: Silo Detail Pages

## 1. The Goal

Provide three UI pages for silo management: the silos list/grid page, the silo creation form, and the individual silo detail view — giving users a complete CRUD interface for their investment platforms.

---

## 2. The Problem It Solves

Users need to see all their silos at a glance, create new ones (up to 5), and manage individual silo settings and holdings. Without these pages, the API layer has no human-facing surface.

---

## 3. The Proposed Solution / Underlying Concept

### Silos List Page (`app/(dashboard)/silos/page.tsx`)

- Fetches silos via `GET /api/silos` using TanStack Query
- Header shows `activeCount / 5 silos used`
- **Create button**: disabled with tooltip when `atLimit = activeCount >= 5`
  - Tooltip text: `"Maximum of 5 active silos reached"`
- Empty state: illustrated empty state with "No silos yet" and CTA
- Grid of `SiloCard` components (one per silo)

### New Silo Page (`app/(dashboard)/silos/new/page.tsx`)

Controlled form fields:

| Field | Input Type | Notes |
|---|---|---|
| Silo name | `type="text"` | Required, maxLength 100 |
| Platform type | Radio group (6 options) | Changing platform auto-sets `baseCurrency` |
| Base currency | `type="text"` (3 chars) | Pre-filled per platform; user-editable |
| Drift threshold | `type="number"` | Default: `5`, range 0–100, step 0.5 |
| Cash balance | `type="number"` | Shown only when `platformType === 'manual'` |

**Platform options:**
```typescript
const PLATFORM_OPTIONS = [
  { value: 'alpaca',     label: 'Alpaca',      description: 'US stocks & ETFs via Alpaca API' },
  { value: 'bitkub',     label: 'BITKUB',      description: 'Thai crypto exchange' },
  { value: 'innovestx',  label: 'InnovestX',   description: 'Thai equities & digital assets' },
  { value: 'schwab',     label: 'Charles Schwab', description: 'US stocks & ETFs via Schwab OAuth' },
  { value: 'webull',     label: 'Webull',      description: 'US & global stocks' },
  { value: 'manual',     label: 'Manual',      description: 'Enter holdings manually — any platform' },
]
```

On submit: `POST /api/silos` → on success invalidates `['silos']` and `['profile']` queries, shows `toast.success`, redirects to `/silos`.

On `SILO_LIMIT_REACHED` error: inline error message shown (not a redirect).

### Silo Detail Page (`app/(dashboard)/silos/[silo_id]/page.tsx`)

- Fetches silo details, holdings, target weights, and drift data
- Displays holding rows with `StalenessTag` when `stale_days > 7`
- Drift state shown per asset using `DriftBadge` (green/yellow/red)
- Edit quantity/cost_basis inline
- Link to `/silos/[silo_id]/rebalance` for rebalancing wizard

### Default Currencies Per Platform

```typescript
const PLATFORM_DEFAULT_CURRENCY = {
  alpaca:    'USD',
  bitkub:    'THB',
  innovestx: 'THB',
  schwab:    'USD',
  webull:    'USD',
  manual:    'USD',
}
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Create button disabled at limit | Set up 5 silos; Create button greyed out with tooltip |
| New silo form validation | Submit empty name → inline error |
| Platform change updates currency | Select BITKUB → baseCurrency auto-fills to THB |
| `pnpm build` | Compiles without errors |
| TanStack Query invalidation | Create silo → SiloCountBadge in sidebar updates |
