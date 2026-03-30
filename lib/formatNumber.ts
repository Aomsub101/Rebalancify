type PriceContext = 'USD' | 'THB'
type QuantityContext = 'stock' | 'crypto'

export function formatNumber(
  value: string | number,
  type: 'price' | 'weight' | 'weight-input' | 'drift' | 'quantity' | 'staleness',
  context?: PriceContext | QuantityContext
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (!Number.isFinite(num)) return '—'

  switch (type) {
    case 'price': {
      const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return context === 'THB' ? `฿${formatted}` : `$${formatted}`
    }
    case 'weight':
      return `${num.toFixed(2)}%`
    case 'weight-input':
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
        useGrouping: false,
      })
    case 'drift': {
      const fixed = Math.abs(num).toFixed(2)
      return num >= 0 ? `+${fixed}%` : `-${fixed}%`
    }
    case 'quantity': {
      if (context === 'crypto') {
        return num.toFixed(8)
      }
      // stock: 0dp for integers, max 4dp fractional
      if (Number.isInteger(num) || num % 1 === 0) {
        return String(Math.round(num))
      }
      // up to 4dp, stripping trailing zeros
      return parseFloat(num.toFixed(4)).toString()
    }
    case 'staleness': {
      if (num === 0) return 'today'
      return num === 1 ? '1 day ago' : `${num} days ago`
    }
    default:
      return String(num)
  }
}
