# TS.1.3 — Alpaca Settings UI

## Task
Build the Alpaca section in Settings page with masked key inputs and paper/live mode selector.

## Target
`app/(dashboard)/settings/page.tsx` (Alpaca section)

## Inputs
- TS.1.2 outputs (Alpaca key storage API)
- `docs/architecture/04-component-tree.md` §2.9

## Process
1. Add AlpacaSection to Settings page:
   - `ConnectionStatusDot` (green = connected, grey = disconnected)
   - `AlpacaModeSelector`: paper | live radio buttons
   - `ApiKeyInput`: type="password" with show/hide toggle
   - `ApiSecretInput`: type="password" with show/hide toggle
   - `SaveButton`: calls PATCH /api/profile with encrypted keys
   - After save: field displays `••••••••` (masked)
2. Connection status reads `alpaca_connected` from profile
3. Live mode shows `AlpacaLiveBadge` warning

## Outputs
- Alpaca section in `app/(dashboard)/settings/page.tsx`
- `components/settings/ConnectionStatusDot.tsx`

## Verify
- Save keys → connection status turns green
- Masked display after save
- Paper/live mode toggle persists

## Handoff
→ TS.1.4 (Alpaca sync)
