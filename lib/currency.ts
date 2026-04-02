import Decimal from 'decimal.js'

export type CurrencyCode = 'USD' | 'THB' | string

export function convertAmount(
  amount: Decimal.Value,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rateToUsdMap: Record<string, string | number>,
): Decimal {
  const value = new Decimal(amount ?? 0)
  if (fromCurrency === toCurrency) return value

  const fromRate = new Decimal(rateToUsdMap[fromCurrency] ?? 1)
  const toRate = new Decimal(rateToUsdMap[toCurrency] ?? 1)
  if (fromRate.lte(0) || toRate.lte(0)) return value

  return value.mul(fromRate).div(toRate)
}

export function cashCurrencyForPlatform(platformType: string, baseCurrency: CurrencyCode): CurrencyCode {
  switch (platformType) {
    case 'alpaca':
    case 'schwab':
    case 'webull':
      return 'USD'
    case 'bitkub':
    case 'innovestx':
      return 'THB'
    default:
      return baseCurrency
  }
}
