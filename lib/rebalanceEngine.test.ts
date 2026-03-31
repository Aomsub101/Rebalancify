/**
 * Unit tests for lib/rebalanceEngine.ts — post-migration-23
 *
 * Pure function tests; no DB or HTTP calls.
 *
 * New interface (migration 23):
 *   - EngineHolding: no more cash_balance (cash is on silos)
 *   - EngineInput: cashBalance replaces include_cash + cash_amount
 *   - Cash is a first-class target weight (complement to 100%)
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
): EngineHolding {
  return { asset_id, ticker, quantity, price }
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
     *   AAPL: qty=10, price=100 → current_value=1000
     *   GOOG: qty=2, price=300 → current_value=600
     *   silo cash_balance = 200
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
      makeHolding('asset-goog', 'GOOG', '2.00000000', '300.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-goog', '50.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      cashBalance: '200.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    expect(result.balance_errors).toHaveLength(0)

    const sellOrder = result.orders.find(o => o.asset_id === 'asset-aapl')
    const buyOrder = result.orders.find(o => o.asset_id === 'asset-goog')

    expect(sellOrder).toBeDefined()
    expect(sellOrder!.order_type).toBe('sell')

    expect(buyOrder).toBeDefined()
    expect(buyOrder!.order_type).toBe('buy')

    // Key invariant: buy cost ≤ available capital (cash + sell proceeds)
    const sellProceeds = new Decimal(sellOrder!.quantity).mul(sellOrder!.price_at_calc)
    const available = new Decimal('200.00000000').plus(sellProceeds)
    const buyCost = new Decimal(buyOrder!.quantity).mul(buyOrder!.price_at_calc)

    expect(buyCost.lte(available.plus('0.00000001'))).toBe(true)
  })

  it('scales buy orders down when available capital is insufficient', () => {
    /**
     * Setup:
     *   SPY: qty=1, price=500 → current_value=500 (100% of assets)
     *   silo cash_balance = 10
     *   total_value = 510
     *
     * Targets: SPY=40%, QQQ=60%
     *   SPY target = 510 * 0.4 = 204 → delta = -296 → SELL ceil(296/500) = 1 share
     *   QQQ target = 510 * 0.6 = 306 → BUY floor(306/600) = 0 shares (QQQ price=600, no holding yet)
     *
     * After sell: available = cash(10) + sell_proceeds(500) = 510
     * QQQ buy_qty = floor(306/600) = 0 → filtered out (zero qty)
     * → Only a SELL order for SPY
     */
    const holdings: EngineHolding[] = [
      makeHolding('asset-spy', 'SPY', '1.00000000', '500.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-spy', '40.000'),
      makeWeight('asset-qqq', '60.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      cashBalance: '10.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)

    const totalBuyCost = result.orders
      .filter(o => o.order_type === 'buy')
      .reduce((sum, o) => sum.plus(o.estimated_value), new Decimal(0))
    const totalSellProceeds = result.orders
      .filter(o => o.order_type === 'sell')
      .reduce((sum, o) => sum.plus(o.estimated_value), new Decimal(0))
    const available = new Decimal('10.00000000').plus(totalSellProceeds)

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
      cashBalance: '0.00000000',
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
        makeHolding('asset-goog', 'GOOG', '2.00000000', '300.00000000'),
      ],
      weights: weightsA,
      mode: 'partial',
      cashBalance: '200.00000000',
    }

    const inputB: EngineInput = {
      holdings: [
        makeHolding('asset-aapl', 'AAPL', '100.00000000', '100.00000000'),
        makeHolding('asset-goog', 'GOOG', '20.00000000', '300.00000000'),
      ],
      weights: weightsA,
      mode: 'partial',
      cashBalance: '2000.00000000',
    }

    const resultA = calculateRebalance(inputA)
    const resultB = calculateRebalance(inputB)

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
      makeHolding('asset-btc', 'BTC', '0.10000000', '10000.00000000'),
    ]
    const weights: EngineWeight[] = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-btc', '40.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      cashBalance: '200.00000000',
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
      cashBalance: '0.00000000',
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
      cashBalance: '1000.00000000',
    }

    const start = Date.now()
    const result = calculateRebalance(input)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(2000)
    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Test 7 — Full mode: ±0.01% accuracy (AC1)
// ---------------------------------------------------------------------------

describe('calculateRebalance – full mode accuracy', () => {
  it('achieves post-execution weights within ±0.01% of targets', () => {
    /**
     * Setup:
     *   AAPL: qty=10, price=100, value=1000
     *   MSFT: qty=0, price=200, no value
     *   silo cash_balance=1000
     *   total_value = 1000 + 0 + 1000 = 2000
     *
     * Targets: AAPL=50%, MSFT=50%
     *   AAPL delta = 1000 - 1000 = 0 → no order
     *   MSFT delta = 1000 - 0 = 1000 → buy round(1000/200) = 5 shares → cost=1000
     *
     * available = 1000 (cash) ≥ 1000 (buy) → balance_valid=true
     * weight_after for MSFT = 1000/2000 = 50% exactly
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '100.00000000'),
      makeHolding('asset-msft', 'MSFT', '0.00000000', '200.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '50.000'),
      makeWeight('asset-msft', '50.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'full',
      cashBalance: '1000.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    expect(result.balance_errors).toHaveLength(0)

    const msftOrder = result.orders.find(o => o.asset_id === 'asset-msft')
    expect(msftOrder).toBeDefined()
    expect(msftOrder!.order_type).toBe('buy')

    // Post-execution weight must be within ±0.01% of 50%
    expect(Math.abs(msftOrder!.weight_after_pct - 50)).toBeLessThan(0.01)
  })

  it('full mode uses ROUND_HALF_UP for buy quantities (more accurate than floor)', () => {
    /**
     * AAPL: qty=0, price=100, cash_balance=400
     * MSFT: qty=0, price=300, cash_balance=600
     * total=1000
     * Targets: AAPL=40%, MSFT=60%
     *
     * AAPL target=400, buy round(400/100)=4 shares → cost=400
     * MSFT target=600, buy round(600/300)=2 shares → cost=600
     * total buy cost=1000 = available → balance_valid=true
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '0.00000000', '100.00000000'),
      makeHolding('asset-msft', 'MSFT', '0.00000000', '300.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-msft', '60.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'full',
      cashBalance: '1000.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)

    const aaplOrder = result.orders.find(o => o.asset_id === 'asset-aapl')
    const msftOrder = result.orders.find(o => o.asset_id === 'asset-msft')

    expect(aaplOrder).toBeDefined()
    expect(msftOrder).toBeDefined()

    // Both weight_after_pct within ±0.01% of targets
    expect(Math.abs(aaplOrder!.weight_after_pct - 40)).toBeLessThan(0.01)
    expect(Math.abs(msftOrder!.weight_after_pct - 60)).toBeLessThan(0.01)
  })
})

// ---------------------------------------------------------------------------
// Test 8 — Pre-flight failure: insufficient cash in full mode (AC2)
// ---------------------------------------------------------------------------

describe('calculateRebalance – full mode pre-flight failure', () => {
  it('returns balance_valid=false with balance_errors when buy cost exceeds available', () => {
    /**
     * Setup:
     *   AAPL: qty=0, price=300
     *   silo cash_balance=200
     *   total=200
     *   Target: AAPL=100%
     *
     *   buy_qty = round(200/300) = round(0.666...) = 0.66666667 (round-up at 8dp)
     *   buy_cost = 0.66666667 × 300 = 200.00000100
     *   available = 200 (cash) + 0 (sells) = 200
     *   200.00000100 > 200 → INSUFFICIENT → balance_valid=false
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '0.00000000', '300.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '100.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'full',
      cashBalance: '200.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(false)
    expect(result.balance_errors.length).toBeGreaterThan(0)
    expect(result.balance_errors[0]).toMatch(/shortfall/i)
  })

  it('partial mode does NOT fail pre-flight — it scales down instead', () => {
    /**
     * Same scenario but mode='partial'.
     * Partial mode scales down the buy to fit within available capital.
     * → balance_valid=true (partial mode never fails pre-flight)
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '0.00000000', '300.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '100.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'partial',
      cashBalance: '200.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    expect(result.balance_errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Test 9 — Full mode cash target: cash treated as first-class target
// ---------------------------------------------------------------------------

describe('calculateRebalance – full mode cash as target weight', () => {
  it('sells overweight assets to raise cash when cash is below target', () => {
    /**
     * Setup:
     *   AAPL: qty=10, price=50 → value=500 (50% of portfolio)
     *   MSFT: qty=0, price=50 → value=0 (0%)
     *   CASH: 500 (50% of portfolio)
     *   total = 1000
     *
     * Targets: AAPL=40%, MSFT=40%, CASH=20%
     *   Cash target = 200, current = 500 → excess = 300
     *   AAPL target = 400, current = 500 → overweight by 100 → SELL 2 shares
     *   MSFT target = 400, current = 0 → underweight → BUY 8 shares
     *
     * The cash being above target means we buy underweight assets,
     * which uses the excess cash. After buying MSFT, cash should be at 20%.
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '50.00000000'),
      makeHolding('asset-msft', 'MSFT', '0.00000000', '50.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '40.000'),
      makeWeight('asset-msft', '40.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'full',
      cashBalance: '500.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    // Cash is over target (500 vs target of 200), so we should buy MSFT
    const msftBuy = result.orders.find(o => o.asset_id === 'asset-msft' && o.order_type === 'buy')
    expect(msftBuy).toBeDefined()
    // And sell some AAPL
    const aaplSell = result.orders.find(o => o.asset_id === 'asset-aapl' && o.order_type === 'sell')
    expect(aaplSell).toBeDefined()
  })

  it('buys underweight assets to spend cash when cash is above target', () => {
    /**
     * Setup:
     *   AAPL: qty=10, price=50 → value=500 (50%)
     *   CASH: 500 (50%)
     *   total = 1000
     *
     * Targets: AAPL=60%, CASH=40%
     *   Cash target = 400, current = 500 → excess = 100
     *   AAPL target = 600, current = 500 → underweight by 100 → BUY 2 shares
     *
     * After buying 2 AAPL shares at $50 = $100, cash goes from 500 to 400 = 40%
     */
    const holdings = [
      makeHolding('asset-aapl', 'AAPL', '10.00000000', '50.00000000'),
    ]
    const weights = [
      makeWeight('asset-aapl', '60.000'),
    ]
    const input: EngineInput = {
      holdings,
      weights,
      mode: 'full',
      cashBalance: '500.00000000',
    }

    const result = calculateRebalance(input)

    expect(result.balance_valid).toBe(true)
    // Cash is above target → buy AAPL
    const aaplBuy = result.orders.find(o => o.asset_id === 'asset-aapl' && o.order_type === 'buy')
    expect(aaplBuy).toBeDefined()
  })
})
