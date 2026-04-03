import { describe, expect, it } from 'vitest'
import {
  buildManualInstruction,
  getApprovedOrderIds,
  getPlatformLabel,
  getTotalEstimatedValue,
  splitOrdersByType,
} from '@/lib/rebalanceUi'
import type { RebalanceOrder } from '@/lib/types/rebalance'

const ORDERS: RebalanceOrder[] = [
  {
    id: 'buy-1',
    asset_id: 'asset-1',
    ticker: 'AAPL',
    order_type: 'buy',
    quantity: '2.00000000',
    estimated_value: '400.00',
    price_at_calc: '200.00',
    weight_before_pct: 10,
    weight_after_pct: 15,
  },
  {
    id: 'sell-1',
    asset_id: 'asset-2',
    ticker: 'TSLA',
    order_type: 'sell',
    quantity: '1.00000000',
    estimated_value: '300.00',
    price_at_calc: '300.00',
    weight_before_pct: 20,
    weight_after_pct: 12,
  },
]

describe('rebalanceUi helpers', () => {
  it('maps platform labels with InnovestX aliases', () => {
    expect(getPlatformLabel('innovestx')).toBe('InnovestX')
    expect(getPlatformLabel('investx')).toBe('InnovestX')
  })

  it('derives approved IDs and total value from skipped orders', () => {
    const skippedIds = new Set(['sell-1'])

    expect(getApprovedOrderIds(ORDERS, skippedIds)).toEqual(['buy-1'])
    expect(getTotalEstimatedValue(ORDERS, skippedIds)).toBe(400)
  })

  it('splits buy and sell orders', () => {
    const { buyOrders, sellOrders } = splitOrdersByType(ORDERS)

    expect(buyOrders).toHaveLength(1)
    expect(sellOrders).toHaveLength(1)
  })

  it('builds manual instructions without changing wording', () => {
    expect(buildManualInstruction(ORDERS[0], 'Alpaca')).toBe(
      'Buy 2 shares of AAPL at market on Alpaca.',
    )
    expect(buildManualInstruction(ORDERS[1], 'Alpaca')).toBe(
      'Sell 1 share of TSLA at market on Alpaca.',
    )
  })
})
