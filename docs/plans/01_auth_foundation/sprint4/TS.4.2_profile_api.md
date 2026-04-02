# TS.4.2 — Profile API

## Task
Implement GET and PATCH /api/profile endpoints for user profile management.

## Target
`app/api/profile/route.ts`

## Inputs
- TS.2.2 outputs (server Supabase client)
- `docs/architecture/02-database-schema.md` (user_profiles table)
- `docs/architecture/03-api-contract.md`

## Process
1. Create `app/api/profile/route.ts`:
   - **GET:** Validate JWT → query `user_profiles` → compute `notification_count` (unread notifications) → return profile JSON
     - Response includes: `display_name`, `global_currency`, `show_usd_toggle`, `drift_notif_channel`, `onboarded`, `progress_banner_dismissed`, `notification_count`
     - Also includes broker connection booleans: `alpaca_connected`, `bitkub_connected`, `innovestx_connected`, `schwab_connected`, `webull_connected`, `llm_connected`
     - **Never** return any `*_enc` column values
   - **PATCH:** Validate JWT → update allowed fields only:
     - `display_name`, `drift_notif_channel`, `show_usd_toggle`, `global_currency`, `onboarded`, `progress_banner_dismissed`
     - Broker keys handled separately (Component 03/04)
2. Add input validation (reject unknown fields, validate enum values)
3. Return 401 if no valid JWT, 400 if invalid input

## Outputs
- `app/api/profile/route.ts`

## Verify
- `GET /api/profile` returns profile with computed fields
- `PATCH /api/profile` updates only allowed fields
- No `*_enc` columns in GET response
- 401 without JWT

## Handoff
→ TS.4.3 (OfflineBanner)
