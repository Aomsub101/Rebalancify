/**
 * lib/rebalanceEngine.ts — Deterministic Portfolio Rebalancing Engine
 *
 * Pure function — no DB calls, no side effects.
 * The API route is responsible for fetching data and persisting results.
 *
 * Post-migration-23: cash_balance lives on silos, not on individual holdings.
 * Cash is a first-class target weight (the complement of asset weights to 100%).
 *
 * Partial mode:
 *   1. total = Σ(qty × price) + cashBalance
 *   2. SELL overweight assets (ceil to whole shares, cap at holding qty)
 *   3. Pool = existingCash + sellProceeds
 *   4. BUY underweight assets using pool only (floor, then scale proportionally if insufficient)
 *
 * Full mode:
 *   1. total = Σ(qty × price) + cashBalance
 *   2. Cash target weight = 100 − sum(non-cash weights)
 *   3. Compute delta for each asset (target − current)
 *   4. If cash is over target: buy underweight assets proportionally
 *      If cash is under target: sell overweight assets proportionally
 *   5. Round quantities (half-up) — no scaling; pre-flight if capital insufficient
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
  /** NUMERIC(20,8) — the silo's cash_balance (post-migration 23) */
  cashBalance: string
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

/** Round to 8 decimal places, half-up (for buy quantities in full mode). */
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

export function calculateRebalance(input: EngineInput): EngineResult {
  const { holdings, weights, mode, cashBalance } = input

  // -------------------------------------------------------------------------
  // Build lookup maps
  // -------------------------------------------------------------------------

  const holdingMap = new Map<string, EngineHolding>(
    holdings.map(h => [h.asset_id, h]),
  )
  const weightMap = new Map<string, Decimal>(
    weights.map(w => [w.asset_id, new Decimal(w.weight_pct)]),
  )

  // -------------------------------------------------------------------------
  // Step 1 — Compute total portfolio value
  // -------------------------------------------------------------------------

  const siloCash = new Decimal(cashBalance ?? '0')

  let assetValue = new Decimal(0)
  for (const h of holdings) {
    assetValue = assetValue.plus(new Decimal(h.quantity).mul(h.price))
  }

  const totalValue = assetValue.plus(siloCash)

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
  // Step 4 — Compute deltas for all assets in weights
  // -------------------------------------------------------------------------

  const allAssetIds = new Set<string>([
    ...weights.map(w => w.asset_id),
    ...holdings.map(h => h.asset_id),
  ])

  interface AssetInfo {
    asset_id: string
    ticker: string
    targetWeightPct: Decimal
    targetValue: Decimal
    currentValue: Decimal
    holding: EngineHolding | undefined
    price: Decimal
  }

  const assets: AssetInfo[] = []

  for (const assetId of allAssetIds) {
    const targetWeightPct = weightMap.get(assetId) ?? new Decimal(0)
    const targetValue = totalValue.mul(targetWeightPct).div(100)
    const holding = holdingMap.get(assetId)
    const price = holding ? new Decimal(holding.price) : new Decimal(0)
    const currentValue = holding ? new Decimal(holding.quantity).mul(price) : new Decimal(0)
    const ticker = holding?.ticker ?? assetId

    if (price.isZero()) continue

    assets.push({ asset_id: assetId, ticker, targetWeightPct, targetValue, currentValue, holding, price })
  }

  // -------------------------------------------------------------------------
  // Step 5 — Build raw sell/buy orders
  // -------------------------------------------------------------------------

  interface RawOrder {
    asset_id: string
    ticker: string
    order_type: 'buy' | 'sell'
    quantity: Decimal
    price: Decimal
    currentValue: Decimal
  }

  const rawSells: RawOrder[] = []
  const rawBuys: RawOrder[] = []

  for (const a of assets) {
    const delta = a.targetValue.minus(a.currentValue)

    if (delta.lt(0)) {
      // Overweight → SELL
      let sellQty = ceilAt8(delta.abs().div(a.price))
      if (a.holding) {
        const holdQty = new Decimal(a.holding.quantity)
        if (sellQty.gt(holdQty)) sellQty = holdQty
      }
      if (sellQty.gt(0)) {
        rawSells.push({ asset_id: a.asset_id, ticker: a.ticker, order_type: 'sell', quantity: sellQty, price: a.price, currentValue: a.currentValue })
      }
    } else if (delta.gt(0)) {
      // Underweight → BUY
      const buyQty = mode === 'full'
        ? roundAt8(delta.div(a.price))
        : floorAt8(delta.div(a.price))
      if (buyQty.gt(0)) {
        rawBuys.push({ asset_id: a.asset_id, ticker: a.ticker, order_type: 'buy', quantity: buyQty, price: a.price, currentValue: a.currentValue })
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 6 — Mode-specific processing
  // -------------------------------------------------------------------------

  const sellProceeds = rawSells.reduce(
    (sum, o) => sum.plus(o.quantity.mul(o.price)),
    new Decimal(0),
  )
  const available = siloCash.plus(sellProceeds)

  let totalBuyCost = rawBuys.reduce(
    (sum, o) => sum.plus(o.quantity.mul(o.price)),
    new Decimal(0),
  )

  let balanceValid = true
  let balanceErrors: string[] = []

  if (mode === 'partial') {
    // Scale down buys proportionally to fit available capital
    if (totalBuyCost.gt(available) && !available.isZero()) {
      const scaleFactor = available.div(totalBuyCost)
      for (const buy of rawBuys) {
        buy.quantity = floorAt8(buy.quantity.mul(scaleFactor))
      }
    } else if (totalBuyCost.gt(available) && available.isZero()) {
      for (const buy of rawBuys) {
        buy.quantity = new Decimal(0)
      }
    }
  } else {
    // Full mode: treat cash as a target-weight asset
    // targetCash − currentCash determines extra buys or sells
    const targetCash = totalValue.mul(cashTargetPct).div(100)
    const cashAfterBaseTrades = siloCash.plus(sellProceeds).minus(totalBuyCost)
    const cashDelta = targetCash.minus(cashAfterBaseTrades) // positive = need more cash

    if (cashDelta.lt(0)) {
      // Cash is too HIGH — spend excess by buying underweight assets proportionally
      const excessCash = cashDelta.abs()
      const underAssets = assets.filter(a => {
        const d = a.targetValue.minus(a.currentValue)
        return d.gt(0) && a.price.gt(0)
      })
      const totalUnder = underAssets.reduce(
        (sum, a) => sum.plus(a.targetValue.minus(a.currentValue)),
        new Decimal(0),
      )
      if (totalUnder.gt(0) && excessCash.gt(0)) {
        for (const a of underAssets) {
          const underAmt = a.targetValue.minus(a.currentValue)
          const ratio = underAmt.div(totalUnder)
          const extraValue = excessCash.mul(ratio)
          const extraQty = roundAt8(extraValue.div(a.price))
          if (extraQty.gt(0)) {
            const existing = rawBuys.find(b => b.asset_id === a.asset_id)
            if (existing) {
              existing.quantity = existing.quantity.plus(extraQty)
            } else {
              rawBuys.push({ asset_id: a.asset_id, ticker: a.ticker, order_type: 'buy', quantity: extraQty, price: a.price, currentValue: a.currentValue })
            }
          }
        }
      }
    } else if (cashDelta.gt(0)) {
      // Cash is too LOW — raise cash by selling overweight assets proportionally
      const shortfall = cashDelta
      const overAssets = assets.filter(a => {
        const d = a.targetValue.minus(a.currentValue)
        return d.lt(0) && a.price.gt(0)
      })
      const totalOver = overAssets.reduce(
        (sum, a) => sum.plus(a.currentValue.minus(a.targetValue)),
        new Decimal(0),
      )
      if (totalOver.gt(0) && shortfall.gt(0)) {
        for (const a of overAssets) {
          const overAmt = a.currentValue.minus(a.targetValue)
          const ratio = overAmt.div(totalOver)
          const sellValue = shortfall.mul(ratio)
          let extraSellQty = ceilAt8(sellValue.div(a.price))
          if (a.holding) {
            const holdQty = new Decimal(a.holding.quantity)
            if (extraSellQty.gt(holdQty)) extraSellQty = holdQty
          }
          if (extraSellQty.gt(0)) {
            const existing = rawSells.find(s => s.asset_id === a.asset_id)
            if (existing) {
              existing.quantity = existing.quantity.plus(extraSellQty)
            } else {
              rawSells.push({ asset_id: a.asset_id, ticker: a.ticker, order_type: 'sell', quantity: extraSellQty, price: a.price, currentValue: a.currentValue })
            }
          }
        }
      }
    }

    // Recompute buy cost after cash-adjustment buys were added
    totalBuyCost = rawBuys.reduce(
      (sum, o) => sum.plus(o.quantity.mul(o.price)),
      new Decimal(0),
    )
    const finalSellProceeds = rawSells.reduce(
      (sum, o) => sum.plus(o.quantity.mul(o.price)),
      new Decimal(0),
    )
    const finalAvailable = siloCash.plus(finalSellProceeds)

    if (totalBuyCost.gt(finalAvailable)) {
      const shortfall = totalBuyCost.minus(finalAvailable)
      balanceValid = false
      balanceErrors = [
        `Insufficient capital: need ${toFixed8(totalBuyCost)}, have ${toFixed8(finalAvailable)} (shortfall: ${toFixed8(shortfall)})`,
      ]
    }
  }

  // -------------------------------------------------------------------------
  // Step 7 — Build final orders
  // -------------------------------------------------------------------------

  const finalOrders: EngineOrder[] = []

  for (const sell of rawSells) {
    if (sell.quantity.lte(0)) continue
    const estValue = sell.quantity.mul(sell.price)
    const weightBefore = totalValue.isZero() ? new Decimal(0) : sell.currentValue.div(totalValue).mul(100)
    const valueAfter = sell.currentValue.minus(estValue)
    const weightAfter = totalValue.isZero() ? new Decimal(0) : valueAfter.div(totalValue).mul(100)

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

  for (const buy of rawBuys) {
    if (buy.quantity.lte(0)) continue
    const estValue = buy.quantity.mul(buy.price)
    const weightBefore = totalValue.isZero() ? new Decimal(0) : buy.currentValue.div(totalValue).mul(100)
    const valueAfter = buy.currentValue.plus(estValue)
    const weightAfter = totalValue.isZero() ? new Decimal(0) : valueAfter.div(totalValue).mul(100)

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

  return {
    orders: finalOrders,
    balance_valid: balanceValid,
    balance_errors: balanceErrors,
    weights_sum_pct: toPct3(weightsSumPct),
    cash_target_pct: toPct3(cashTargetPct),
    snapshot_before: snapshot,
  }
}
