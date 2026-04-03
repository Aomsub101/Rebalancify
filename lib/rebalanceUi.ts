import { formatNumber } from '@/lib/formatNumber'
import type { CalculateResponse, RebalanceOrder } from '@/lib/types/rebalance'

const PLATFORM_LABELS: Record<string, string> = {
  alpaca: 'Alpaca',
  bitkub: 'BITKUB',
  innovestx: 'InnovestX',
  investx: 'InnovestX',
  schwab: 'Charles Schwab',
  webull: 'Webull',
  dime: 'DIME',
  manual: 'Manual',
}

export function getPlatformLabel(platformType: string): string {
  return PLATFORM_LABELS[platformType] ?? platformType
}

export function getApprovedOrderIds(
  orders: RebalanceOrder[],
  skippedIds: Set<string>,
): string[] {
  return orders.filter((order) => !skippedIds.has(order.id)).map((order) => order.id)
}

export function getTotalEstimatedValue(
  orders: RebalanceOrder[],
  skippedIds?: Set<string>,
): number {
  return orders
    .filter((order) => !skippedIds?.has(order.id))
    .reduce((sum, order) => sum + parseFloat(order.estimated_value), 0)
}

export function splitOrdersByType(orders: RebalanceOrder[]) {
  return {
    buyOrders: orders.filter((order) => order.order_type === 'buy'),
    sellOrders: orders.filter((order) => order.order_type === 'sell'),
  }
}

export function buildManualInstruction(
  order: CalculateResponse['orders'][number],
  platformLabel: string,
): string {
  const action = order.order_type === 'buy' ? 'Buy' : 'Sell'
  const quantity = formatNumber(order.quantity, 'quantity', 'stock')

  return `${action} ${quantity} share${parseFloat(order.quantity) !== 1 ? 's' : ''} of ${order.ticker} at market on ${platformLabel}.`
}
