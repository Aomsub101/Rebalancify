# Sub-Component: Alpaca Sync

## 1. The Goal

Fetch all open positions from Alpaca (paper or live API) for a silo and upsert them as holdings in the local database — keeping the Rebalancify portfolio in sync with the user's actual Alpaca account.

---

## 2. The Problem It Solves

Users who already have positions on Alpaca need a way to import them into Rebalancify without manually entering each holding. The sync endpoint fetches all positions from Alpaca's REST API and upserts them as holdings in the `holdings` table, recording `last_synced_at` on the silo.

---

## 3. The Proposed Solution / Underlying Concept

### POST /api/silos/:id/sync

**Flow:**

```
POST /api/silos/:id/sync
    │
    ├── Authenticate
    ├── Verify silo ownership + platform_type === 'alpaca'
    ├── Fetch alpaca_key_enc + alpaca_secret_enc from user_profiles
    ├── Decrypt credentials (server-side only)
    ├── Select base URL: paper-api.alpaca.markets OR api.alpaca.markets
    ├── GET /v2/positions → Alpaca positions array
    ├── For each position:
    │   ├── Find or create asset in `assets` table (ticker lookup)
    │   ├── Upsert into `holdings`: { silo_id, asset_id, quantity }
    │   └── Set last_price_refreshed_at = now()
    └── UPDATE silos.last_synced_at = now()
```

### Alpaca API Response Shape

```typescript
// GET /v2/positions — each position has:
{
  symbol: string,        // ticker, e.g. "AAPL"
  qty: string,           // quantity as decimal string
  market_value: string,   // current value
  // ...
}
```

### Upsert Logic

```typescript
// For each Alpaca position:
// 1. Find asset by ticker
// 2. Upsert holdings row
await supabase
  .from('holdings')
  .upsert({
    silo_id,
    asset_id: foundAsset.id,
    quantity: position.qty,
    last_price_refreshed_at: new Date().toISOString(),
  }, { onConflict: 'silo_id,asset_id' })
```

### Server-Side Only

All Alpaca API calls happen in the Next.js API route — **zero browser requests to alpaca.markets**. The browser only ever sees the sync result (success/failure).

### `last_synced_at` on Silos

After sync completes, `silos.last_synced_at` is updated with the current timestamp. This is displayed on `SiloCard` and in the silo detail header.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Zero browser requests to Alpaca | Network tab: no `alpaca.markets` requests during sync |
| Credentials decrypted server-side | Response body never contains `alpaca_key_enc` or plaintext key |
| Positions upserted | Call sync → `holdings` table contains positions for the silo |
| `last_synced_at` updated | After sync → `silos.last_synced_at` is recent timestamp |
| Paper mode uses paper-api | `alpaca_mode='paper'` → requests go to `paper-api.alpaca.markets` |
| `pnpm test` | `app/api/silos/[silo_id]/__tests__/sync.test.ts` passes |
