# TS.1.3 — Auth Trigger

## Task
Create the `on_auth_user_created` trigger that auto-creates a `user_profiles` row on signup.

## Target
`supabase/migrations/01_users_trigger.sql`

## Inputs
- TS.1.2 outputs (user_profiles table exists)

## Process
1. Create function `handle_new_user()` as `SECURITY DEFINER`:
   ```sql
   CREATE OR REPLACE FUNCTION handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.user_profiles (id) VALUES (NEW.id);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
2. Create trigger on `auth.users`:
   ```sql
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```
3. Test by creating a user via Supabase Auth dashboard

## Outputs
- Trigger function and trigger created
- Every new auth.users row automatically gets a user_profiles row

## Verify
- Create test user via Supabase Auth → `SELECT * FROM user_profiles WHERE id = '<user_id>'` returns 1 row
- Profile has correct defaults: `global_currency='USD'`, `onboarded=FALSE`, etc.

## Handoff
→ TS.1.4 (RLS verification)
