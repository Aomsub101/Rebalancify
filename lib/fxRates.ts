/**
 * lib/fxRates.ts
 * ExchangeRate-API v6 integration helpers.
 * Used by GET /api/fx-rates to fetch and cache currency rates.
 *
 * All monetary computations use string representation to 8dp (CLAUDE.md Rule 3).
 */

/** Shape of a successful ExchangeRate-API v6 response. */
interface ExchangeRateApiResponse {
  result: string
  'error-type'?: string
  conversion_rates?: Record<string, number>
}

/**
 * Parses an ExchangeRate-API v6 `latest/USD` JSON response.
 *
 * @param data - Raw JSON body (unknown — validated here)
 * @returns Record of currency code → rate relative to USD (e.g. THB: 35.5 means 1 USD = 35.5 THB)
 * @throws Error if the API returned a non-success result or malformed data
 */
export function parseExchangeRates(data: unknown): Record<string, number> {
  if (typeof data !== 'object' || data === null) {
    throw new Error('ExchangeRate-API returned unexpected data type')
  }

  const body = data as ExchangeRateApiResponse

  if (body.result !== 'success') {
    throw new Error(`ExchangeRate-API error: ${body['error-type'] ?? 'unknown'}`)
  }

  if (!body.conversion_rates || typeof body.conversion_rates !== 'object') {
    throw new Error('ExchangeRate-API returned no conversion_rates')
  }

  return body.conversion_rates
}

/**
 * Computes the rate_to_usd for a given currency.
 * rate_to_usd = 1 / conversion_rate (since conversion_rates are expressed as "1 USD = X currency")
 * For USD itself, rate_to_usd = 1.
 *
 * @param currency - ISO 4217 currency code (e.g. "THB")
 * @param rates    - From parseExchangeRates (USD-based)
 * @returns NUMERIC(20,8) string (e.g. "0.02816901")
 * @throws Error when currency is not present in rates
 */
export function rateToUsd(currency: string, rates: Record<string, number>): string {
  const rateFromUsd = rates[currency]
  if (rateFromUsd === undefined) {
    throw new Error(`Currency ${currency} not found in exchange rates`)
  }

  const rateToUsdValue = 1 / rateFromUsd
  // Truncate (not round) to 8dp to match NUMERIC(20,8) stored precision
  return rateToUsdValue.toFixed(8)
}
