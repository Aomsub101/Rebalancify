# 08 — ExecutionModeNotice

## The Goal

Inform users that the Rebalancing Wizard will not submit orders automatically for non-Alpaca platforms, and that they must execute the resulting orders manually on their broker's platform. This is a persistent, non-dismissible notice to prevent user confusion at the execution step.

---

## The Problem It Solves

Rebalancify v1.0 supports automated order execution only via Alpaca. For BITKUB, InnovestX, Schwab, and Webull, orders can be calculated but must be executed manually by the user on their broker's platform. Without a clear, persistent banner, users might expect orders to submit automatically and not understand why nothing happens after clicking "Confirm."

---

## The Proposed Solution

A persistent, non-dismissible banner appears in **Rebalancing Wizard Step 2 (Review)** for any non-Alpaca silo. It cannot be closed, dismissed, or hidden. The only way to dismiss it is to close the wizard entirely.

---

## Implementation Details

**File:** `components/rebalance/OrderReviewPanel.tsx`

**Condition:**
```tsx
{!isAlpaca && (
  <div className="flex items-start gap-3 ...">
    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
    <p className="text-sm">
      These orders will not be submitted automatically. After reviewing,
      you will execute them manually on {platformName}.
    </p>
  </div>
)}
```

`isAlpaca` is derived from the silo `platform_type === 'alpaca'`. `platformName` is the human-readable platform name.

### Platform Names

| `platform_type` | Banner Text |
|---|---|
| `bitkub` | "... on BITKUB." |
| `innovestx` | "... on InnovestX." |
| `schwab` | "... on Charles Schwab." |
| `webull` | "... on Webull." |
| `manual` | No banner shown (manual silos cannot be rebалаanced via the wizard) |

### Visual Properties

- Amber/warning colour (`text-warning`)
- Contains an `AlertCircle` icon (non-colour signal — satisfies accessibility Rule 13)
- No close/dismiss button
- No `onOpenChange` handler on any wrapping Dialog
- Appears above the order table in Step 2

---

## Testing & Verification

| Check | Method |
|---|---|
| Banner appears for BITKUB silo | Manual: open wizard for BITKUB silo → amber banner visible |
| Banner appears for InnovestX silo | Manual: open wizard for InnovestX silo → amber banner visible |
| Banner appears for Schwab silo | Manual: open wizard for Schwab silo → amber banner visible |
| Banner appears for Webull silo | Manual: open wizard for Webull silo → amber banner visible |
| No banner for Alpaca silo | Manual: open wizard for Alpaca silo → no amber banner |
| Banner is non-dismissible | Manual: attempt to close → no close button or overlay dismiss |
| Correct platform name per silo | Manual: open wizard for each platform → text matches platform |
| Icon present (non-colour signal) | Visual inspection: `AlertCircle` icon visible in banner |
