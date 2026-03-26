# docs/architecture/06-security-privacy.md — Security & Privacy

## AGENT CONTEXT

**What this file is:** The consolidated security and privacy specification for Rebalancify. Every security requirement from the PRD is expressed here with implementation constraints.
**Derived from:** PRD_v1.3.md Section 5.6, Section 8.3, TECH_DOCS_v1.2.md (all sections), CLAUDE.md Rules 4, 5, 6, 16, 18
**Connected to:** docs/architecture/02-database-schema.md (RLS policies), CLAUDE.md (critical rules 4, 5, 16, 18), stories/STORY-TEMPLATE.md (Definition of Done — RLS verification)
**Critical rules for agents using this file:**
- The phrase "never expose" applies to: API keys, plaintext tokens, user PII in logs, monetary values with floating-point errors.
- The phrase "encrypted at rest" applies to: all `*_enc` columns in user_profiles.
- The phrase "proxied through" applies to: every external API call — it must go through a Next.js API route.

---

## 1. Data Classification

| Data Category | Sensitivity | Examples |
|---|---|---|
| Authentication credentials | Critical | Supabase JWT, encrypted API keys |
| Broker API keys | Critical | `alpaca_key_enc`, `bitkub_key_enc`, etc. |
| LLM API keys | Critical | `llm_key_enc` |
| OAuth tokens | Critical | `schwab_access_enc`, `schwab_refresh_enc` |
| Portfolio holdings | Sensitive | Quantities, cost basis |
| Target weights | Sensitive | Allocation percentages |
| Rebalancing history | Sensitive | Session snapshots |
| News article state | Low | Read/dismissed flags |
| Asset prices | Public | Cached from public APIs |
| FX rates | Public | Cached from public APIs |

---

## 2. Encryption Specification

**Algorithm:** AES-256-GCM (symmetric encryption)

**Key location:** Vercel environment variable `ENCRYPTION_KEY` — a 256-bit random key generated at deployment. Never in source code, never in the database.

**What is encrypted:** Every `*_enc` column in `user_profiles`:
- `alpaca_key_enc`, `alpaca_secret_enc`
- `bitkub_key_enc`, `bitkub_secret_enc`
- `innovestx_key_enc`, `innovestx_secret_enc`
- `schwab_access_enc`, `schwab_refresh_enc`
- `webull_key_enc`, `webull_secret_enc`
- `llm_key_enc`

**Encryption happens:** In the Next.js API route (`PATCH /api/profile`) immediately after receiving the plaintext key. The plaintext is never written to any database, log, or variable that persists beyond the current request.

**Decryption happens:** In the Next.js API route that needs to call the external API. The decrypted plaintext is used once for the API call and then garbage-collected. It is never returned to the client.

**IV/nonce:** A fresh 96-bit IV is generated for every encryption operation. Stored as a prefix of the ciphertext: `[16 bytes IV][variable ciphertext]` encoded as base64.

---

## 3. API Key Handling — Complete Flow

```
1. User enters key in Settings (type="password" input)
   ↓
2. Browser sends PATCH /api/profile { alpaca_key: "PLAINTEXT" }
   ↓
3. Next.js API route (app/api/profile/route.ts):
   - Validates JWT (auth.uid())
   - Generates fresh IV
   - Encrypts: ciphertext = AES-256-GCM(ENCRYPTION_KEY, IV, PLAINTEXT)
   - Stores: UPDATE user_profiles SET alpaca_key_enc = base64(IV + ciphertext)
   - Returns: { alpaca_connected: true } — no key value returned
   ↓
4. UI displays: "••••••••" (masked) — the key is never shown again

--- (Later, when Alpaca sync is triggered) ---

5. Browser: POST /api/silos/:id/sync
   ↓
6. Next.js API route (app/api/silos/[id]/sync/route.ts):
   - Validates JWT
   - Fetches user_profiles.alpaca_key_enc from Supabase
   - Decrypts: plaintext = AES-256-GCM-decrypt(ENCRYPTION_KEY, IV, ciphertext)
   - Makes request to Alpaca API using plaintext key
   - Returns holdings data to browser
   - plaintext goes out of scope and is garbage-collected
   ↓
7. Browser: receives holdings data (no key visible anywhere)
```

---

## 4. RLS Policy Reference

Every table that stores user-specific data has Row Level Security enabled. The policy ensures users can only access their own data.

| Table | Policy | Effect |
|---|---|---|
| `user_profiles` | `USING (id = auth.uid())` | Users see only their own profile |
| `silos` | `USING (user_id = auth.uid())` | Users see only their own silos |
| `asset_mappings` | `USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()))` | Users see only mappings for their silos |
| `holdings` | `USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()))` | Users see only their own holdings |
| `target_weights` | `USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()))` | Users see only their own weights |
| `rebalance_sessions` | `USING (user_id = auth.uid())` | Users see only their own sessions |
| `rebalance_orders` | `USING (session_id IN (SELECT id FROM rebalance_sessions WHERE user_id = auth.uid()))` | Users see only their own orders |
| `user_article_state` | `USING (user_id = auth.uid())` | Users see only their own read/dismiss state |
| `knowledge_chunks` | `USING (user_id = auth.uid())` | Users see only their own uploaded document chunks |
| `research_sessions` | `USING (user_id = auth.uid())` | Users see only their own research sessions |
| `assets` | `FOR SELECT USING (TRUE)` | Global read — everyone can read the asset registry |
| `price_cache` | `FOR SELECT USING (TRUE)` | Global read — everyone can read cached prices |
| `fx_rates` | `FOR SELECT USING (TRUE)` | Global read — everyone can read FX rates |
| `news_cache` | `FOR SELECT USING (TRUE)` | Global read — everyone can read cached articles |

**RLS verification procedure (run for every story that touches the database):**
```sql
-- As user A's JWT: insert a silo (note the silo_id)
-- As user B's JWT: attempt to SELECT that silo_id
-- Expected: 0 rows returned (RLS filters it out)
```

---

## 5. PDPA Compliance Checklist (Thailand Personal Data Protection Act)

| Requirement | Implementation |
|---|---|
| Published privacy policy | Privacy policy page at `/privacy` — describes data collected, purposes, retention periods |
| Data processing register | Internal register maintained by the developer listing: data categories, purposes, legal basis, retention, third parties |
| User data deletion mechanism | `DELETE /api/account` endpoint — deletes `auth.users` row (Supabase cascades to all user tables) + Supabase Storage files |
| Data minimisation | Only data necessary for the feature is collected. News read state is optional. Cost basis is optional. |
| Consent for email | Drift digest email: user explicitly opts in during onboarding or Settings. Default `drift_notif_channel = 'both'` — review if this constitutes implicit consent for Thai law |
| Third-party disclosures | Supabase (EU/US data processing), Vercel (US), Resend (US) — disclosed in privacy policy |
| Right of access | `GET /api/profile` returns all stored user data. Full data export endpoint added before public launch if legally required |
| Formal PDPC registration | Completed if and when user base exceeds the threshold requiring registration |

---

## 6. Security-Visible UI Patterns

These UI elements communicate security to the user. They must be implemented as described.

| Pattern | Implementation Constraint |
|---|---|
| API key inputs | `type="password"` with show/hide toggle. After save: displays `••••••••` only. Never auto-fill from browser. |
| Order execution confirmation | `ConfirmDialog` displays: exact order count, platform name, total estimated value. Non-dismissible (no `onOpenChange`). |
| Alpaca live mode indicator | Persistent amber `AlpacaLiveBadge` on silo card AND at top of rebalancing wizard. Cannot be hidden. |
| Manual order instructions | Step 3 of wizard shows per-order plain-language instructions: "Buy X shares of AAPL on [Platform Name]." |
| Regulatory disclaimer | "This is not financial advice." in footer of every page. Always visible, never collapsible. |
| Connection status | Green dot = connected (key is stored). Grey dot = not connected. Never shows key value. |

---

## 7. Threat Model

| Threat | Mitigation |
|---|---|
| **API key exfiltration via XSS** | All external API calls proxied through Next.js API routes. Keys never in browser JS bundle or localStorage. React's JSX rendering auto-escapes values. |
| **Cross-user data access (horizontal privilege escalation)** | RLS on every user-data table. Supabase JWT auto-sets `auth.uid()` — no user can forge another's ID. Verified for every story. |
| **Insider data theft (from Supabase breach)** | All keys encrypted at rest with AES-256-GCM. `ENCRYPTION_KEY` is in Vercel env — not in Supabase. A Supabase breach exposes encrypted ciphertext only. |
| **Order submission without user approval** | `ConfirmDialog` is non-dismissible. The execute endpoint requires both `session_id` and `approved_order_ids` — no implicit "approve all" path. |
| **Stale price manipulation (feeding old prices to inflate/deflate orders)** | `price_cache_fresh` view enforces 15-min TTL. Manual refresh bypasses TTL only on explicit user action. Prices are fetched server-side — not user-supplied. |

---

## 8. What Never to Do

| Forbidden Action | Why |
|---|---|
| Log API keys or tokens | Logs may be stored unencrypted in Vercel/Supabase. Any key in a log is compromised. |
| Store keys in Vercel environment variable as a user value | `ENCRYPTION_KEY` is a system secret; user keys go in the database (encrypted). |
| Return `*_enc` column values in any API response | Even the encrypted value reveals that a key is stored. Use `*_connected: boolean` instead. |
| Use `Math.random()` for session IDs or security tokens | Not cryptographically secure. Use `crypto.randomUUID()` or Supabase `gen_random_uuid()`. |
| Accept a `price` field from the client in holdings endpoints | Prices must always come from `price_cache` (server-fetched). Client-supplied prices could be manipulated. |
| Allow `rebalance_sessions` to be updated | Breaks immutability guarantee. History becomes untrustworthy. |
| Skip RLS verification in the Definition of Done | A story that passes acceptance criteria but leaks data between users is a critical security bug. |
| Call external APIs (Finnhub, Alpaca, LLM providers) from client components | Exposes API keys in network requests visible to the browser. |
