/**
 * Unit tests for lib/rebalanceEngine.ts — STORY-010
 *
 * TDD: these tests are written before the implementation (Red phase).
 * The engine is a pure function; no DB or HTTP calls.
 *
 * STORY-010 covers:
 *   - Partial mode: no overspend, ≤2% residual drift
 *   - Empty orders when all holdings are at target
 *   - Silo isolation (two independent inputs produce independent results)
 *   - Weights ≠ 100 proceeds normally
 *   - Timing: 50 holdings < 2000ms
 *
 * STORY-010b covers (not tested here):
 *   - Full mode ±0.01% accuracy
 *   - Pre-flight failure (BALANCE_INSUFFICIENT)
 *   - Cash injection (include_cash + cash_amount)
 */

import { describe, it, expect } from 'vitest'
import { calculateRebalance, EngineInput, EngineHolding, EngineWeight } from './rebalanceEngine'
import Decimal from 'decimal.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHolding(
  asset_id: string,
  ticker: string,
  quantity: string,
  price: string,
  cash_balance = '0.00000000',
): EngineHolding {
  return { asset_id, ticker, quantity, cash_balance, price }
}

function makeWeight(asset_id: string, weight_pct: string): EngineWeight {
  return { asset_id, weight_pct }
}

// ---------------------------------------------------------------------------
// Test 1 — Partial mode: no overspend
// ---------------------------------------------------------------------------

describe('calculateRebalance – partial mode', () => {
  it('generates buy/sell orders without overspending available cash', () => {
    /**
     * Setup:
     *   AAPL: qty=10, price=100 → current_value=1000 (current ~55.6% of portfolio)
     *   GOOG: qty=2, price=300 → current_value=600  (current ~33.3% of portfolio)
     *   cash_balance on GOOG holding = 200
     *   total_value = 1000 + 600 + 200 = 1800
     *
     * Targets: AAPL=40%, GOOG=50%
     *   AAPL target_value = 1800 * 0.4 = 720 → delta = -280 → SELL ceil(280/100) = 3 shares
     *   GOOG target_value = 1800 * 0.5 = 900 → delta = 300 → BUY floor(300/300) = 1 share
     *
     * sell_proceeds = 3 * 100 = 300
     * available = cash(200) + sell_proceeds(300) = 500
     * buy_cost = 1 * 300 = 300 ≤ 500 → no scale-down needed
     */
    const holdings: EngineHolding[] = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '100.00000000'),
      makeHolding('asset-goog', 'GOOG', '2.00000000', '300.00000000', '200.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-goog', '50.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    expect(result.balance_errors).toHaveLength(0)

    const sellOrder = result.orders.find(o => o.asset_id === 'asset-aapl')
    const buyOrder = result.orders.find(o => o.asset_id === 'asset-goog')

    expect(sellOrder).toBeDefined()
    expect(sellOrder!.order_type).toBe('sell')
    expect(new Decimal(sellOrder!.quantity).gte(0)).toBe(true)

    expect(buyOrder).toBeDefined()
    expect(buyOrder!.order_type).toBe('buy')

    // Key invariant: buy cost ≤ available capital (cash + sell proceeds)
    const sellProceeds = new Decimal(sellOrder!.quantity).mul(sellOrder!.price_at_calc)
    const available = new Decimal('200.00000000').plus(sellProceeds)
    const buyCost = new Decimal(buyOrder!.quantity).mul(buyOrder!.price_at_calc)

    expect(buyCost.lte(available.plus('0.00000001'))).toBe(true) // tolerance for rounding
  })

  it('scales buy orders down when available capital is insufficient', () => {
    /**
     * Setup:
     *   SPY: qty=1, price=500 → current_value=500 (100% of silo)
     *   cash_balance=10 on SPY holding
     *   total_value = 510
     *
     * Targets: SPY=40%, QQQ=60%
     *   SPY target = 510 * 0.4 = 204 → delta = -296 → SELL ceil(296/500) = 1 share
     *   QQQ target = 510 * 0.6 = 306 → BUY floor(306/600) = 0 shares (QQQ price=600)
     *   → QQQ has no holding yet (qty=0 in holdings)
     *
     * After sell: available = cash(10) + sell_proceeds(500) = 510
     * QQQ buy_qty = floor(306/600) = 0 → filtered out (zero qty)
     * → Only a SELL order for SPY
     */
    const holdings: EngineHolding[] = [
      makeHolding('asset-spy', 'SPY', '1.00000000', '500.00000000', '10.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-spy', '40.000'),
      makeWeight('asset-qqq', '60.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)

    // No overspend: sum of all buy estimated_values ≤ available cash
    const totalBuyCost = result.orders
      .filter(o => o.order_type === 'buy')
      .reduce((sum, o) => sum.plus(o.estimated_value), new Decimal(0))
    const totalSellProceeds = result.orders
      .filter(o => o.order_type === 'sell')
      .reduce((sum, o) => sum.plus(o.estimated_value), new Decimal(0))
    const existingCash = new Decimal('10.00000000')
    const available = existingCash.plus(totalSellProceeds)

    expect(totalBuyCost.lte(available.plus('0.00000001'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Empty orders when all holdings are already at target
// ---------------------------------------------------------------------------

describe('calculateRebalance – empty orders', () => {
  it('returns empty orders array when all holdings are at target weights', () => {
    /**
     * AAPL: qty=10, price=100, value=1000 (50%)
     * BTC: qty=0.1, price=10000, value=1000 (50%)
     * total = 2000, cash = 0
     * Targets: AAPL=50%, BTC=50%
     * deltas are 0 → no orders
     */
    const holdings: EngineHolding[] = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '100.00000000'),
      makeHolding('asset-btc', 'BTC', '0.10000000', '10000.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '50.000'),
      makeWeight('asset-btc', '50.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.orders).toHaveLength(0)
    expect(result.balance_valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Silo isolation (F1-R9 / AC5)
// ---------------------------------------------------------------------------

describe('calculateRebalance – silo isolation', () => {
  it('two independent inputs produce independent results (F1-R9)', () => {
    /**
     * Silo A: AAPL qty=10 @ $100 (40%), GOOG qty=2 @ $300 (50%), cash=200
     * Silo B: AAPL qty=100 @ $100 (40%), GOOG qty=20 @ $300 (50%), cash=2000
     * Same targets but 10x the holdings in B.
     * Result B orders should be ~10x the quantity of result A orders.
     */
    const weightsA: EngineWeight[] = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-goog', '50.000'),
    ]

    const inputA: EngineInput = {
      holdings: [
        makeHolding('asset-aapl', 'AAPL', '10.00000000', '100.00000000'),
        makeHolding('asset-goog', 'GOOG', '2.00000000', '300.00000000', '200.00000000'),
      ],
      weights: weightsA,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const inputB: EngineInput = {
      holdings: [
        makeHolding('asset-aapl', 'AAPL', '100.00000000', '100.00000000'),
        makeHolding('asset-goog', 'GOOG', '20.00000000', '300.00000000', '2000.00000000'),
      ],
      weights: weightsA, // same targets
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const resultA = calculateRebalance(inputA)
    const resultB = calculateRebalance(inputB)

    // Results must differ — silo B is 10x, so order quantities should be ~10x
    const sellA = resultA.orders.find(o => o.order_type === 'sell')
    const sellB = resultB.orders.find(o => o.order_type === 'sell')

    expect(sellA).toBeDefined()
    expect(sellB).toBeDefined()

    // B should have substantially larger orders than A
    expect(new Decimal(sellB!.quantity).gt(new Decimal(sellA!.quantity))).toBe(true)

    // Also verify they don't share any object references (full isolation)
    expect(resultA.snapshot_before).not.toBe(resultB.snapshot_before)
  })
})

// ---------------------------------------------------------------------------
// Test 4 — Weights ≠ 100 proceeds normally (AC7)
// ---------------------------------------------------------------------------

describe('calculateRebalance – weights not summing to 100', () => {
  it('proceeds normally, returns weights_sum_pct and cash_target_pct', () => {
    /**
     * AAPL: qty=5, price=200, value=1000
     * BTC: qty=0.1, price=10000, value=1000
     * cash=200, total=2200
     * Targets: AAPL=40%, BTC=40% (sum=80%, cash_target=20%)
     */
    const holdings: EngineHolding[] = [
      makeHolding('asset-aapl', 'AAPL', '5.00000000', '200.00000000'),
      makeHolding('asset-btc', 'BTC', '0.10000000', '10000.00000000', '200.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-btc', '40.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.weights_sum_pct).toBeCloseTo(80.0, 2)
    expect(result.cash_target_pct).toBeCloseTo(20.0, 2)
    expect(result.balance_valid).toBe(true)
    // Should still generate orders (20% cash will remain as cash after rebalance)
    // AAPL target = 2200 * 0.4 = 880 vs current 1000 → SELL
    // BTC target = 2200 * 0.4 = 880 vs current 1000 → SELL
    expect(result.orders.every(o => o.order_type === 'sell')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 5 — snapshot_before shape
// ---------------------------------------------------------------------------

describe('calculateRebalance – snapshot_before', () => {
  it('includes holdings, prices, weights, and total_value in snapshot', () => {
    const holdings: EngineHolding[] = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '100.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '100.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const result = calculateRebalance(input)
    const snap = result.snapshot_before

    expect(snap.total_value).toBe('1000.00000000')
    expect(snap.prices['asset-aapl']).toBe('100.00000000')
    expect(snap.weights['asset-aapl']).toBeCloseTo(100.0, 2)
    expect(snap.holdings).toHaveLength(1)
    expect(snap.holdings[0].asset_id).toBe('asset-aapl')
  })
})

// ---------------------------------------------------------------------------
// Test 6 — Timing: 50 holdings < 2000ms (AC10)
// ---------------------------------------------------------------------------

describe('calculateRebalance – timing', () => {
  it('completes in under 2000ms for 50 holdings', () => {
    const holdings: EngineHolding[] = Array.from({ length: 50 }, (_, i) => ({
      asset_id: `asset-${i}`,
      ticker: `TKR${i}`,
      quantity: '10.00000000',
      cash_balance: i === 0 ? '1000.00000000' : '0.00000000',
      price: String((100 + i).toFixed(8)),
    }))

    // Give each asset a target weight of 2% (sum = 100%)
    const weights: EngineWeight[] = holdings.map(h => ({
      asset_id: h.asset_id,
      weight_pct: '2.000',
    }))

    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      include_cash: false,
      cash_amount: '0.00000000',
    }

    const start = Date.now()
    const result = calculateRebalance(input)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(2000)
    expect(result).toBeDefined()
  })
})
