# Sub-Component: Progress Banner

## 1. The Goal

Show a 3-step progress tracker on the Overview page when a user has completed onboarding but has a silo with zero holdings. The banner guides the user through: (1) Add holdings, (2) Set target weights, (3) Run first rebalance. Each step fills in as the user completes it. The banner is dismissible server-side.

---

## 2. The Problem It Solves

After onboarding, a new user with an empty silo may not know what to do next. The progress banner provides a clear, linear path: add holdings → set weights → run rebalance. Without it, the empty silo state is confusing and users may churn before achieving their first rebalance.

---

## 3. The Proposed Solution / Underlying Concept

### Display Condition

Banner shows when ALL of the following are true:
- `onboarded === TRUE`
- At least one active silo exists
- That silo has zero holdings

### 3-Step Display

```
● Add holdings → ○ Set target weights → ○ Run first rebalance
```

| Step | Filled When |
|---|---|
| ● Add holdings | `holdings.length > 0` |
| ○ Set target weights | All holdings have `target_weight > 0` |
| ○ Run first rebalance | `rebalance_sessions.length > 0` (at least one executed session) |

### Step Visual States

- **Pending**: hollow circle `○`, muted text
- **Current** (step 1 only): hollow circle `○`, bold text
- **Complete**: filled circle `●`, normal text, `text-positive`

### Dismissal

Dismiss button (X) in top-right of banner. On click:
1. `PATCH /api/profile` sets `progress_banner_dismissed = TRUE`
2. Banner disappears
3. **NOT stored in localStorage** — server-side flag ensures it persists across devices

After dismissal, banner never reappears (server-side flag checked on every Overview page load).

### Reactive Updates

Step completion is derived reactively from TanStack Query cache:
- Adding a holding → step 1 fills
- Setting all target weights → step 2 fills
- Completing a rebalance session → step 3 fills

No page reload is needed for steps to update.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Banner shown when onboarded + empty silo | Create silo → Overview → banner visible |
| Banner NOT shown when onboarded + has holdings | Add holding → Overview → banner gone |
| Step 1 fills when holding added | Add holding → verify hollow → filled |
| Step 2 fills when all weights set | Set all weights → verify step 2 fills |
| Step 3 fills after rebalance session | Complete rebalance → verify step 3 fills |
| Dismiss X button visible | Banner → X button in corner |
| Dismiss calls PATCH /api/profile | Click X → network tab → `PATCH /api/profile` |
| Dismiss persists across hard refresh | Dismiss → hard refresh → banner absent |
| Dismiss persists across devices | Dismiss on desktop → login on mobile → no banner |
