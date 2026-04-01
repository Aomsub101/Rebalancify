# Sub-Component: Session Context

## 1. The Goal

Expose a single React context (`SessionContext`) that provides authenticated user state, profile data, global UI toggles (USD display mode), and reactive silo count to any component in the tree without prop drilling.

---

## 2. The Problem It Solves

Every authenticated page needs access to: (a) the Supabase session/user object, (b) the user's profile from `user_profiles`, (c) whether to show values in USD, and (d) how many active silos the user has. Passing these as props through multiple layers creates tight coupling. A context solves this once; all consumers read from it.

---

## 3. The Proposed Solution / Underlying Concept

### Context Shape (`SessionContextValue`)

```typescript
interface SessionContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null        // fetched from user_profiles table
  showUSD: boolean                   // mirrors profile.show_usd_toggle (local toggle)
  setShowUSD: (value: boolean) => void
  siloCount: number                  // count of active silos for this user
  setSiloCount: (value: number) => void
  onboarded: boolean                // derived from profile.onboarded
  progressBannerDismissed: boolean  // derived from profile.progress_banner_dismissed
  refreshProfile: () => Promise<void> // re-fetches profile + silo count after mutations
  isLoading: boolean
}
```

### UserProfile Shape

```typescript
interface UserProfile {
  id: string
  email: string
  display_name: string | null
  base_currency: string
  show_usd_toggle: boolean    // note: old typo in DB column name preserved
  onboarded: boolean
  progress_banner_dismissed: boolean
  created_at: string
  updated_at: string
}
```

### Initialization Flow

1. `SessionProvider` mounts and calls `supabase.auth.onAuthStateChange()`
2. On any auth event (including initial load), the callback fetches the profile from `user_profiles` and the active silo count
3. `isLoading` starts `true` and becomes `false` after first auth callback fires
4. `refreshProfile()` is a manual re-fetch function exposed for use after onboarding or silo mutations

### USD Toggle Pattern

`showUSD` is stored in two places: the profile column (`show_usd_toggle`) and local React state. The local state enables optimistic UI — the toggle responds instantly. On toggle, `setShowUSD` fires immediately, then a `PATCH /api/profile` call persists the value. If the API call fails, the optimistic update is not rolled back (simplified implementation).

### Queries Used

- `supabase.from('user_profiles').select('*').eq('id', userId).single()`
- `supabase.from('silos').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true)`

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Context provides null initially | Render a consumer before auth — session/user/profile all null |
| `onAuthStateChange` fires on login | Add `console.log` to callback, login, observe fire |
| Silo count updates reactively | Create a silo in another tab; observe count update |
| `refreshProfile` works | Call after PATCH to `/api/profile`; profile values update |
| `isLoading` transitions correctly | Observe component render: `isLoading=true` → `false` |
| `pnpm test` | Tests for this context live in `contexts/SessionContext.test.tsx` (if present) |
