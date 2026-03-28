/**
 * lib/fxRates.test.ts
 * TDD Red phase: tests for FX rate helpers.
 * ExchangeRate-API v6 response parsing and rate_to_usd computation.
 */

import { describe, it, expect } from 'vitest'
import { parseExchangeRates, rateToUsd } from './fxRates'

describe('parseExchangeRates', () => {
  const validResponse = {
    result: 'success',
    conversion_rates: {
      USD: 1,
      THB: 35.5,
      EUR: 0.92,
      GBP: 0.79,
    },
  }

  it('returns a record of currency → rate from a valid API response', () => {
    const rates = parseExchangeRates(validResponse)
    expect(rates.USD).toBe(1)
    expect(rates.THB).toBe(35.5)
    expect(rates.EUR).toBe(0.92)
  })

  it('throws when result is not "success"', () => {
    expect(() =>
      parseExchangeRates({ result: 'error', 'error-type': 'invalid-key' }),
    ).toThrow('ExchangeRate-API error')
  })

  it('throws when conversion_rates is missing', () => {
    expect(() => parseExchangeRates({ result: 'success' })).toThrow(
      'ExchangeRate-API returned no conversion_rates',
    )
  })

  it('throws when input is not an object', () => {
    expect(() => parseExchangeRates(null)).toThrow()
    expect(() => parseExchangeRates('string')).toThrow()
    expect(() => parseExchangeRates(42)).toThrow()
  })
})

describe('rateToUsd', () => {
  const rates = { USD: 1, THB: 35.5, EUR: 0.92 }

  it('returns "1.00000000" for USD', () => {
    expect(rateToUsd('USD', rates)).toBe('1.00000000')
  })

  it('computes rate_to_usd for THB (1 / 35.5) to 8 decimal places', () => {
    const result = rateToUsd('THB', rates)
    // 1 / 35.5 = 0.028169014...
    expect(result).toBe('0.02816901')
  })

  it('computes rate_to_usd for EUR (1 / 0.92) to 8 decimal places', () => {
    const result = rateToUsd('EUR', rates)
    // 1 / 0.92 = 1.08695652...
    expect(result).toBe('1.08695652')
  })

  it('throws when currency is not in rates', () => {
    expect(() => rateToUsd('XXX', rates)).toThrow('Currency XXX not found in exchange rates')
  })

  it('returns rate as NUMERIC(20,8) string with exactly 8 decimal places', () => {
    const result = rateToUsd('THB', rates)
    expect(result).toMatch(/^\d+\.\d{8}$/)
  })
})
