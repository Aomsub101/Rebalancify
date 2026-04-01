# Sub-Component: Onboarding Modal

## 1. The Goal

Guide first-time users through platform selection and initial silo creation immediately after their first login. The modal presents the 7 supported platforms as selectable cards, creates the silo on selection, and never appears again after dismissal.

---

## 2. The Problem It Solves

A new user arriving at an empty Overview has no guidance on what to do first. Without onboarding, they must discover silo creation on their own — leading to confusion, abandonment, or support queries. The modal surfaces the key decision (which platform to connect) as the very first action.

---

## 3. The Proposed Solution / Underlying Concept

### Trigger Condition

Modal shows when ALL of the following are true:
- `user_profiles.onboarded === FALSE`
- `active_silo_count === 0`
- User has verified their email (auth session complete)

### Platform Cards

Seven selectable cards:
| Platform | `name` field | `platform_type` | `base_currency` | Badge |
|---|---|---|---|---|
| Alpaca | "Alpaca Portfolio" | `alpaca` | `USD` | "Alpaca" |
| BITKUB | "BITKUB" | `bitkub` | `THB` | "BITKUB" |
| InnovestX | "InnovestX" | `innovestx` | `THB` | "InnovestX" |
| Schwab | "Charles Schwab" | `schwab` | `USD` | "Schwab" |
| Webull | "Webull" | `webull` | `USD` | "Webull" |
| DIME | "DIME" | `manual` | `THB` | "DIME" (special case) |
| Other | User enters name | `manual` | `USD` | "MANUAL" |

**DIME Special Case**: The `PlatformBadge` for DIME shows "DIME" (not "MANUAL"). This is determined by the silo's `name` field, not `platform_type`.

**"Other" Platform**: Selecting this shows a text input for the user to enter a custom silo name. A "MANUAL" badge is shown.

### Create Flow

1. User selects a platform card → card gets selected state (border highlight)
2. User clicks "Create silo" → `POST /api/silos` with pre-filled platform defaults
3. Modal closes → user navigated to `/silos/[new_silo_id]`
4. Progress banner appears

### Skip Flow

1. User clicks "Skip for now" → `PATCH /api/profile` sets `onboarded = TRUE`
2. Modal closes → user lands on Overview
3. No progress banner shown

### Non-Dismissible Rule

Modal has NO `onOpenChange` handler. Clicking the backdrop does nothing. Pressing Escape does nothing. The only way to close it is "Create silo" or "Skip for now". This matches the `ConfirmDialog` rule (Rule 10, CLAUDE.md).

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Modal shown on first login | Create new account → verify modal visible |
| Modal NOT shown on second login | Login again → verify modal absent |
| All 7 platforms shown | Visual: 7 cards present |
| "Other" shows text input | Click "Other" → text input appears |
| "Skip for now" closes modal | Click skip → modal gone, Overview shown |
| Skip sets onboarded = TRUE | DB: `SELECT onboarded FROM user_profiles WHERE id = $1` |
| Create silo → navigated to silo page | Click Create → router navigates to `/silos/[id]` |
| ESC does not close modal | Focus modal → press ESC → modal stays |
| Backdrop click does not close modal | Click backdrop outside modal → modal stays |
| DIME badge shows "DIME" | Create DIME silo → PlatformBadge → "DIME" |
| `pnpm build` | Modal compiles without errors |
