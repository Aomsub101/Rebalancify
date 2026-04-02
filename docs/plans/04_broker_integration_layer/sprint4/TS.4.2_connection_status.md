# TS.4.2 — Connection Status Components

## Task
Build ConnectionStatusDot and TokenExpiryWarning shared components.

## Target
`components/settings/`

## Inputs
- `docs/architecture/components/04_broker_integration_layer/07-settings_broker_sections.md`

## Process
1. `components/settings/ConnectionStatusDot.tsx`:
   - Props: `{ connected: boolean }`
   - Green dot when connected, grey dot when disconnected
   - Small circle (8px) with label text
2. `components/settings/TokenExpiryWarning.tsx`:
   - Props: `{ expiresAt: string | null }`
   - Shown when `schwab_token_expires < NOW() + 2 days`
   - Amber banner: "Your Schwab connection expires in X days. Reconnect to continue syncing."
   - Hidden when token is not expiring soon or Schwab not connected

## Outputs
- `components/settings/ConnectionStatusDot.tsx`
- `components/settings/TokenExpiryWarning.tsx`

## Verify
- Dot shows correct color based on connection state
- Warning appears only when token expiring within 2 days
- Warning hidden for non-Schwab brokers

## Handoff
→ TS.4.3 (ExecutionModeNotice)
