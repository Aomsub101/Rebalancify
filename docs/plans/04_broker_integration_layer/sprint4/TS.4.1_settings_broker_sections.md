# TS.4.1 — Settings Broker Sections

## Task
Build BITKUB, InnovestX, Schwab, and Webull sections in the Settings page.

## Target
`app/(dashboard)/settings/page.tsx` (broker sections)

## Inputs
- Sprint 1-3 outputs (all broker key storage APIs)
- `docs/architecture/components/04_broker_integration_layer/07-settings_broker_sections.md`
- `docs/architecture/04-component-tree.md` §2.9

## Process
1. Add broker sections to Settings page:
   - **BITKUB:** key + secret inputs, ConnectionStatusDot
   - **InnovestX Settrade Equity:** key + secret inputs, ConnectionStatusDot
   - **InnovestX Digital Assets:** key + secret inputs, ConnectionStatusDot
   - **Schwab:** OAuth "Connect"/"Disconnect" button, TokenExpiryWarning banner
   - **Webull:** key + secret inputs, ConnectionStatusDot, "$500 minimum" note
2. All inputs: `type="password"` with show/hide toggle
3. After save: field displays `••••••••` (masked)
4. Each section has independent Save button → PATCH /api/profile
5. Connection status reads `*_connected` booleans from profile

## Outputs
- Broker sections in `app/(dashboard)/settings/page.tsx`
- `components/settings/BrokerSection.tsx` (reusable)

## Verify
- All 5 broker sections render
- Save → connection status updates
- Masked display after save
- Schwab OAuth button redirects correctly

## Handoff
→ TS.4.2 (Connection status components)
