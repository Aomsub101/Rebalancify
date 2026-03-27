import { describe, it, expect } from 'vitest'
import { formatNumber } from '../formatNumber'

describe('formatNumber', () => {
  describe("type='price'", () => {
    it('formats USD price with $ prefix and 2dp', () => {
      expect(formatNumber('185.20000000', 'price', 'USD')).toBe('$185.20')
    })
    it('formats THB price with ฿ prefix and 2dp', () => {
      expect(formatNumber('5000.00000000', 'price', 'THB')).toBe('฿5,000.00')
    })
    it('formats zero USD as $0.00', () => {
      expect(formatNumber('0.00000000', 'price', 'USD')).toBe('$0.00')
    })
  })
  describe("type='weight'", () => {
    it('formats weight as percentage with 2dp', () => {
      expect(formatNumber('14.820', 'weight')).toBe('14.82%')
    })
  })
  describe("type='drift'", () => {
    it('prefixes positive drift with +', () => {
      expect(formatNumber('2.18', 'drift')).toBe('+2.18%')
    })
    it('prefixes negative drift with -', () => {
      expect(formatNumber('-1.50', 'drift')).toBe('-1.50%')
    })
  })
  describe("type='quantity'", () => {
    it('formats stock integer quantity with 0dp', () => {
      expect(formatNumber('100.00000000', 'quantity', 'stock')).toBe('100')
    })
    it('formats stock fractional quantity with up to 4dp', () => {
      expect(formatNumber('10.50000000', 'quantity', 'stock')).toBe('10.5')
    })
    it('formats crypto quantity with 8dp always', () => {
      expect(formatNumber('0.00123456', 'quantity', 'crypto')).toBe('0.00123456')
    })
    it('formats crypto quantity with trailing zeros preserved', () => {
      expect(formatNumber('0.00245000', 'quantity', 'crypto')).toBe('0.00245000')
    })
  })
  describe("type='staleness'", () => {
    it('formats 0 days as today', () => {
      expect(formatNumber(0, 'staleness')).toBe('today')
    })
    it('formats 1 day ago', () => {
      expect(formatNumber(1, 'staleness')).toBe('1 day ago')
    })
    it('formats multiple days ago', () => {
      expect(formatNumber(14, 'staleness')).toBe('14 days ago')
    })
  })

  describe('edge cases', () => {
    it('returns — for non-numeric string', () => {
      expect(formatNumber('abc', 'price', 'USD')).toBe('—')
    })
    it('returns — for Infinity', () => {
      expect(formatNumber(Infinity, 'weight')).toBe('—')
    })
    it('returns — for NaN', () => {
      expect(formatNumber(NaN, 'drift')).toBe('—')
    })
  })
})
