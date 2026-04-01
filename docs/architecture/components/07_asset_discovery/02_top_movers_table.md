# Sub-Component: Top Movers Table

## 1. The Goal

Display top 5 gainers and top 5 losers for a given asset class (stocks or crypto) in a compact, scannable table format. Each row must communicate directionality through both colour and icon — satisfying accessibility requirements for colour-blind users.

---

## 2. The Problem It Solves

Raw numerical change data (e.g., `+2.34%`, `-1.87%`) is difficult to scan at a glance. Users need instant visual recognition of which assets are moving. Without consistent directional cues (colour + icon), users may misread the table or need to carefully read every number.

---

## 3. The Proposed Solution / Underlying Concept

### Row Structure

Each row displays:
- `ticker` — bold, monospace
- `name` — company/asset name, truncated if too long
- `current_price` — formatted with `formatNumber()`, monospace
- `daily_change_pct` — percentage with sign prefix (e.g., `+2.34%`, `-1.87%`), monospace

### Directional Signals

| Row Type | Background | Icon |
|---|---|---|
| Gainer | `bg-positive/10` (green tint) | `TrendingUp` (Lucide) |
| Loser | `bg-negative/10` (red tint) | `TrendingDown` (Lucide) |

**Rule from Component 7 spec**: Both colour AND icon must be present. Colour alone is insufficient. The directional label (e.g., "Gainer", "Loser") is also rendered as text for maximum accessibility.

### Layout

The table renders two sub-sections — "Top Gainers" and "Top Losers" — each with its own header. Rows within each section are sorted by `daily_change_pct` magnitude.

### Stale Data Indicator

When the API returns `stale: true` (external source was unavailable, cached data used), a `StalenessTag` is rendered above the table indicating the data may be outdated.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Gainer rows have green + TrendingUp | Visual inspection of US Stocks gainer rows |
| Loser rows have red + TrendingDown | Visual inspection of US Stocks loser rows |
| `daily_change_pct` formatted with sign | "2.34%" not "-2.34%", sign prefix required |
| `text-right font-mono tabular-nums` on numeric cells | DevTools inspection of table cells |
| `StalenessTag` appears with `stale: true` | Unit test or manual: mock stale response → tag visible |
| `formatNumber()` used for price | `grep` source for `formatNumber` usage |
