# Sub-Component: Drift Silo Block

## 1. The Goal

Render the drift summary for a single silo inside the `PortfolioDriftSummary` section of the Discover page. Each block shows the silo identity (name, platform badge) and a compact list of holdings with their drift indicators.

---

## 2. The Problem It Solves

`PortfolioDriftSummary` needs to compose drift data for multiple silos. Splitting each silo into its own `DriftSiloBlock` keeps the code modular and allows the block to be reused elsewhere (e.g., on the Overview page sidebar).

---

## 3. The Proposed Solution / Underlying Concept

### Silo Identity

Each block shows:
- `SiloName` — from the silo record
- `PlatformBadge` — shows the broker/platform (Alpaca, BITKUB, Schwab, DIME, etc.)
- "LIVE" badge (amber) if the silo is connected to Alpaca in live trading mode

### Holdings Drift List

Below the silo header, each holding is listed with:
- `ticker` (monospace, bold)
- `DriftBadge` — shows drift magnitude with directional colour and icon:
  - Overweight (drift > 0) → red background + `ArrowUpRight` icon
  - Underweight (drift < 0) → blue/green background + `ArrowDownRight` icon
  - On-target (drift ≈ 0) → neutral background + `Minus` icon

### DriftBadge Specification

- Displays absolute drift percentage (e.g., `2.34%`) NOT the signed value in the badge itself
- The background colour/icon carries the direction signal
- Rule 13 (CLAUDE.md): colour-blind users receive the same information via icon and text label

### Empty Silo State

If `holdings.length === 0`, renders a single-line "No holdings yet" message with a dashed border placeholder.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| PlatformBadge shows correct platform | Visual: Alpaca silo → "Alpaca" badge; DIME → "DIME" |
| LIVE badge appears for Alpaca live silos | Create Alpaca live silo → verify amber "LIVE" badge |
| DriftBadge colour + icon matches direction | Visual: overweight → red + up arrow; underweight → green + down arrow |
| DriftBadge includes text label | Visual: badge always shows text direction label, not just icon |
| Empty holdings state | Empty silo → "No holdings yet" message |
| DriftBadge uses `text-right font-mono tabular-nums` | DevTools inspection |
