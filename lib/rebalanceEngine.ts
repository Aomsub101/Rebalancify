/**
 * lib/rebalanceEngine.ts — Deterministic Portfolio Rebalancing Engine
 *
 * Pure function — no DB calls, no side effects.
 * The API route is responsible for fetching data and persisting results.
 *
 * STORY-010 implements: partial mode + session data preparation
 * STORY-010b implements: full mode, pre-flight 422, cash injection unit tests
 *
 * Partial mode algorithm:
 *   1. total_value = Σ(qty × price) + Σ(cash_balance) + injected_cash
 *   2. For each asset with a target weight, compute delta = target_value − current_value
 *   3. SELL (delta < 0): sell_qty = ceil(|delta| / price), capped at holding.quantity
 *   4. BUY  (delta > 0): buy_qty = floor(delta / price)
 *   5. available = Σ(cash_balance) + injected_cash + sell_proceeds
 *   6. Scale all buys proportionally if total_buy_cost > available
 *   7. Filter zero-quantity orders
 *   8. Compute weight_before_pct and weight_after_pct per order
 *
 * All arithmetic uses decimal.js to avoid floating-point error (CLAUDE.md Rule 3).
 */

import Decimal from 'decimal.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EngineHolding {
  asset_id: string
  ticker: string
  /** NUMERIC(20,8) as string — e.g. "10.00000000" */
  quantity: string
  /** NUMERIC(20,8) as string — sum of cash balances across the silo */
  cash_balance: string
  /** NUMERIC(20,8) as string — from price_cache */
  price: string
}

export interface EngineWeight {
  asset_id: string
  /** NUMERIC(6,3) as string — e.g. "40.000" */
  weight_pct: string
}

export interface EngineInput {
  holdings: EngineHolding[]
  weights: EngineWeight[]
  mode: 'partial' | 'full'
  include_cash: boolean
  /** NUMERIC(20,8) as string — '0.00000000' when not injecting cash */
  cash_amount: string
}

export interface EngineOrder {
  asset_id: string
  ticker: string
  order_type: 'buy' | 'sell'
  /** NUMERIC(20,8) string */
  quantity: string
  /** NUMERIC(20,8) string — quantity × price_at_calc */
  estimated_value: string
  /** NUMERIC(20,8) string — price used at calculation time */
  price_at_calc: string
  /** Percentage with 3 decimal places */
  weight_before_pct: number
  /** Percentage with 3 decimal places */
  weight_after_pct: number
}

export interface EngineSnapshotHolding {
  asset_id: string
  ticker: string
  /** NUMERIC(20,8) string */
  quantity: string
  /** NUMERIC(20,8) string */
  current_value: string
  /** 3dp float */
  weight_pct: number
}

export interface EngineSnapshot {
  holdings: EngineSnapshotHolding[]
  /** asset_id → NUMERIC(20,8) price string */
  prices: Record<string, string>
  /** asset_id → 3dp weight percentage */
  weights: Record<string, number>
  /** NUMERIC(20,8) string */
  total_value: string
}

export interface EngineResult {
  orders: EngineOrder[]
  balance_valid: boolean
  balance_errors: string[]
  weights_sum_pct: number
  cash_target_pct: number
  snapshot_before: EngineSnapshot
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Round to 8 decimal places, ceiling (for sell quantities). */
function ceilAt8(d: Decimal): Decimal {
  return d.toDecimalPlaces(8, Decimal.ROUND_UP)
}

/** Round to 8 decimal places, floor (for buy quantities in partial mode). */
function floorAt8(d: Decimal): Decimal {
  return d.toDecimalPlaces(8, Decimal.ROUND_DOWN)
}

/** Round to 8 decimal places, half-up (for buy quantities in full mode — ±0.01% accuracy). */
function roundAt8(d: Decimal): Decimal {
  return d.toDecimalPlaces(8, Decimal.ROUND_HALF_UP)
}

/** Format a Decimal to NUMERIC(20,8) string. */
function toFixed8(d: Decimal): string {
  return d.toFixed(8)
}

/** Format a Decimal to 3dp float for percentages. */
function toPct3(d: Decimal): number {
  return parseFloat(d.toFixed(3))
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate rebalancing orders for a silo.
 *
 * For STORY-010, only partial mode is implemented.
 * Full mode throws a descriptive error (implemented in STORY-010b).
 */
export function calculateRebalance(input: EngineInput): EngineResult {
  const { holdings, weights, mode, include_cash, cash_amount } = input

  // -------------------------------------------------------------------------
  // Build lookup maps
  // -------------------------------------------------------------------------

  /** asset_id → EngineHolding */
  const holdingMap = new Map<string, EngineHolding>(
    holdings.map(h => [h.asset_id, h])
  )

  /** asset_id → weight_pct as Decimal */
  const weightMap = new Map<string, Decimal>(
    weights.map(w => [w.asset_id, new Decimal(w.weight_pct)])
  )

  // -------------------------------------------------------------------------
  // Step 1 — Compute total portfolio value
  // -------------------------------------------------------------------------

  const injectedCash = include_cash ? new Decimal(cash_amount) : new Decimal(0)

  let assetValue = new Decimal(0)
  let existingCash = new Decimal(0)

  for (const h of holdings) {
    const val = new Decimal(h.quantity).mul(h.price)
    assetValue = assetValue.plus(val)
    existingCash = existingCash.plus(h.cash_balance)
  }

  const totalValue = assetValue.plus(existingCash).plus(injectedCash)

  // -------------------------------------------------------------------------
  // Step 2 — Compute weights_sum_pct and cash_target_pct
  // -------------------------------------------------------------------------

  let weightsSumPct = new Decimal(0)
  for (const w of weights) {
    weightsSumPct = weightsSumPct.plus(w.weight_pct)
  }
  const cashTargetPct = Decimal.max(0, new Decimal(100).minus(weightsSumPct))

  // -------------------------------------------------------------------------
  // Step 3 — Build snapshot_before
  // -------------------------------------------------------------------------

  const snapshotHoldings: EngineSnapshotHolding[] = holdings.map(h => {
    const cv = new Decimal(h.quantity).mul(h.price)
    const wPct = totalValue.isZero() ? new Decimal(0) : cv.div(totalValue).mul(100)
    return {
      asset_id: h.asset_id,
      ticker: h.ticker,
      quantity: h.quantity,
      current_value: toFixed8(cv),
      weight_pct: toPct3(wPct),
    }
  })

  const snapshotPrices: Record<string, string> = {}
  for (const h of holdings) {
    snapshotPrices[h.asset_id] = h.price
  }

  const snapshotWeights: Record<string, number> = {}
  for (const w of weights) {
    snapshotWeights[w.asset_id] = parseFloat(new Decimal(w.weight_pct).toFixed(3))
  }

  const snapshot: EngineSnapshot = {
    holdings: snapshotHoldings,
    prices: snapshotPrices,
    weights: snapshotWeights,
    total_value: toFixed8(totalValue),
  }

  // -------------------------------------------------------------------------
  // Step 4 — Compute deltas; build raw sell/buy orders
  // -------------------------------------------------------------------------

  // Collect all asset_ids that appear in weights
  const allAssetIds = new Set<string>(weights.map(w => w.asset_id))

  interface RawOrder {
    asset_id: string
    ticker: string
    order_type: 'buy' | 'sell'
    quantity: Decimal   // before scale-down
    price: Decimal
    current_value: Decimal
  }

  const rawSells: RawOrder[] = []
  const rawBuys: RawOrder[] = []

  for (const assetId of allAssetIds) {
    const targetWeightPct = weightMap.get(assetId) ?? new Decimal(0)
    const targetValue = totalValue.mul(targetWeightPct).div(100)

    const holding = holdingMap.get(assetId)
    const price = holding ? new Decimal(holding.price) : new Decimal(0)
    const currentValue = holding ? new Decimal(holding.quantity).mul(price) : new Decimal(0)
    const ticker = holding?.ticker ?? assetId

    if (price.isZero()) {
      // No price data — cannot generate order
      continue
    }

    const delta = targetValue.minus(currentValue)

    if (delta.lt('-0.00000001')) {
      // Overweight → SELL
      const sellValue = delta.abs()
      let sellQty = ceilAt8(sellValue.div(price))
      // Cap at holding quantity (can't sell more than we have)
      if (holding) {
        const holdQty = new Decimal(holding.quantity)
        if (sellQty.gt(holdQty)) {
          sellQty = holdQty
        }
      }
      if (sellQty.gt(0)) {
        rawSells.push({ asset_id: assetId, ticker, order_type: 'sell', quantity: sellQty, price, current_value: currentValue })
      }
    } else if (delta.gt('0.00000001')) {
      // Underweight → BUY
      // Partial mode: floor (conservative — never overspend)
      // Full mode: round half-up (closest to target — achieves ±0.01% accuracy)
      const buyQty = mode === 'full'
        ? roundAt8(delta.div(price))
        : floorAt8(delta.div(price))
      if (buyQty.gt(0)) {
        rawBuys.push({ asset_id: assetId, ticker, order_type: 'buy', quantity: buyQty, price, current_value: currentValue })
      }
    }
    // Within epsilon → no order (handled by filter above)
  }

  // -------------------------------------------------------------------------
  // Step 5 — Pool available capital; scale down buys if needed
  // -------------------------------------------------------------------------

  const sellProceeds = rawSells.reduce(
    (sum, o) => sum.plus(o.quantity.mul(o.price)),
    new Decimal(0)
  )
  const available = existingCash.plus(injectedCash).plus(sellProceeds)

  const totalBuyCost = rawBuys.reduce(
    (sum, o) => sum.plus(o.quantity.mul(o.price)),
    new Decimal(0)
  )

  // Pre-flight balance check — behaviour differs by mode:
  //   Partial: scale down buys to fit available capital (always balance_valid=true)
  //   Full:    if buy cost exceeds available, mark balance_valid=false (pre-flight 422)
  let balanceValid = true
  let balanceErrors: string[] = []

  if (mode === 'partial') {
    if (totalBuyCost.gt(available) && !available.isZero()) {
      const scaleFactor = available.div(totalBuyCost)
      for (const buy of rawBuys) {
        buy.quantity = floorAt8(buy.quantity.mul(scaleFactor))
      }
    } else if (totalBuyCost.gt(available) && available.isZero()) {
      // No capital at all → zero all buys
      for (const buy of rawBuys) {
        buy.quantity = new Decimal(0)
      }
    }
  } else {
    // Full mode: pre-flight — refuse if capital is insufficient
    if (totalBuyCost.gt(available)) {
      const shortfall = totalBuyCost.minus(available)
      balanceValid = false
      balanceErrors = [
        `Insufficient capital: need ${toFixed8(totalBuyCost)}, have ${toFixed8(available)} (shortfall: ${toFixed8(shortfall)})`,
      ]
    }
  }

  // -------------------------------------------------------------------------
  // Step 6 — Build final orders (filter zero-qty, compute weight_after)
  // -------------------------------------------------------------------------

  const finalOrders: EngineOrder[] = []

  // Process sells
  for (const sell of rawSells) {
    if (sell.quantity.lte(0)) continue
    const estValue = sell.quantity.mul(sell.price)
    const weightBefore = totalValue.isZero()
      ? new Decimal(0)
      : sell.current_value.div(totalValue).mul(100)
    const valueAfter = sell.current_value.minus(estValue)
    const weightAfter = totalValue.isZero()
      ? new Decimal(0)
      : valueAfter.div(totalValue).mul(100)

    finalOrders.push({
      asset_id: sell.asset_id,
      ticker: sell.ticker,
      order_type: 'sell',
      quantity: toFixed8(sell.quantity),
      estimated_value: toFixed8(estValue),
      price_at_calc: toFixed8(sell.price),
      weight_before_pct: toPct3(weightBefore),
      weight_after_pct: toPct3(Decimal.max(0, weightAfter)),
    })
  }

  // Process buys
  for (const buy of rawBuys) {
    if (buy.quantity.lte(0)) continue
    const estValue = buy.quantity.mul(buy.price)
    const weightBefore = totalValue.isZero()
      ? new Decimal(0)
      : buy.current_value.div(totalValue).mul(100)
    const valueAfter = buy.current_value.plus(estValue)
    const weightAfter = totalValue.isZero()
      ? new Decimal(0)
      : valueAfter.div(totalValue).mul(100)

    finalOrders.push({
      asset_id: buy.asset_id,
      ticker: buy.ticker,
      order_type: 'buy',
      quantity: toFixed8(buy.quantity),
      estimated_value: toFixed8(estValue),
      price_at_calc: toFixed8(buy.price),
      weight_before_pct: toPct3(weightBefore),
      weight_after_pct: toPct3(weightAfter),
    })
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------

  return {
    orders: finalOrders,
    balance_valid: balanceValid,
    balance_errors: balanceErrors,
    weights_sum_pct: toPct3(weightsSumPct),
    cash_target_pct: toPct3(cashTargetPct),
    snapshot_before: snapshot,
  }
}
