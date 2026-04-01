# 07 — Settings Broker Sections

## The Goal

Provide a single, unified Settings page where users can connect, disconnect, and verify the status of all five brokerage integrations. Each section shows a connection indicator, accepts encrypted credential input, and displays masked values after saving.

---

## The Problem It Solves

Each brokerage uses different credentials (API keys, OAuth buttons), and users need to manage all of them from one place. Without a consolidated settings UI, users would need to remember separate connection flows for each platform. The settings page also serves as the hub for diagnosing connection problems (expired tokens, incorrect keys).

---

## Implementation Details

**File:** `app/(dashboard)/settings/page.tsx`

**Profile response builder:** `lib/profile.ts` → `buildProfileResponse()`

### Connection Status Indicator

Each broker section has a `ConnectionStatusDot`:
- **Connected** (green): the encrypted columns are non-null
- **Not connected** (grey): the encrypted columns are null

The `buildProfileResponse()` function derives these from the raw `user_profiles` row:

```typescript
alpaca_connected:     !!(profile.alpaca_key_enc),
bitkub_connected:     !!(profile.bitkub_key_enc),
innovestx_connected: !!(profile.innovestx_key_enc),
innovestx_digital_connected: !!(profile.innovestx_digital_key_enc),
schwab_connected:     !!(profile.schwab_access_enc),
webull_connected:     !!(profile.webull_key_enc),
schwab_token_expired: !!(profile.schwab_token_expires && profile.schwab_token_expires < new Date()),
```

### Credential Input Fields

All key/secret inputs use:
- `type="password"` — browser does not autofill these into wrong fields
- Show/hide toggle button (eye icon) to reveal or hide the value
- After successful save: field is replaced with a masked display `••••••••`
- A separate "Update" button appears when the user wants to change a saved credential

### Schwab OAuth Button

Instead of key/secret inputs, the Schwab section has:
- **Connect** button → navigates to `GET /api/auth/schwab` (initiates OAuth flow)
- **Disconnect** button → calls `PATCH /api/profile` with empty strings to clear encrypted tokens

### Schwab Token Expiry Warning

If `schwab_token_expires < NOW()`, a `TokenExpiryWarning` banner appears in the Schwab section:

> "Your Charles Schwab connection has expired. Please reconnect to restore portfolio sync."

If `schwab_token_expires < NOW() + 2 days` (expiring soon), a softer warning is shown.

### Section Order

The Settings page renders broker sections in this order:
1. Alpaca (Component 3 — but included here for consolidation)
2. BITKUB
3. InnovestX Settrade Equity
4. InnovestX Digital Assets
5. Charles Schwab (OAuth)
6. Webull

---

## Testing & Verification

| Check | Method |
|---|---|
| Green dot when credentials saved | Manual: save credentials → green `ConnectionStatusDot` |
| Grey dot when credentials absent | Manual: no credentials saved → grey dot |
| Password input masked after save | Manual: save Webull key → input shows `••••••••` |
| Show/hide toggle works | Manual: click eye icon → value revealed |
| Schwab OAuth button navigates | Manual: click "Connect Schwab" → redirected to Schwab |
| Token expiry banner appears | Manual: set `schwab_token_expires` to past → banner shown |
| No credentials returned in GET | `grep` for `*_enc` in API response → zero hits |
| All five platforms present | Manual: navigate to /settings → all six sections visible |
