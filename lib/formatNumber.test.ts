import { describe, it, expect } from 'vitest'
import { formatNumber } from './formatNumber'

describe('formatNumber', () => {
  describe('price', () => {
    it('formats USD price with $ prefix', () => {
      expect(formatNumber(14.82, 'price', 'USD')).toBe('$14.82')
    })
    it('formats THB price with ฿ prefix', () => {
      expect(formatNumber(1500, 'price', 'THB')).toBe('฿1,500.00')
    })
    it('returns — for non-finite values', () => {
      expect(formatNumber(NaN, 'price')).toBe('—')
      expect(formatNumber(Infinity, 'price')).toBe('—')
    })
  })

  describe('weight', () => {
    it('formats weight as 2dp percentage', () => {
      expect(formatNumber(14.82, 'weight')).toBe('14.82%')
      expect(formatNumber(100, 'weight')).toBe('100.00%')
      expect(formatNumber(0, 'weight')).toBe('0.00%')
    })
  })

  describe('weight-input', () => {
    it('formats weight as 3dp numeric string without % sign', () => {
      expect(formatNumber(14.82, 'weight-input')).toBe('14.820')
    })
    it('handles zero correctly', () => {
      expect(formatNumber(0, 'weight-input')).toBe('0.000')
    })
    it('handles values with existing 3dp', () => {
      expect(formatNumber(14.125, 'weight-input')).toBe('14.125')
    })
    it('returns — for non-finite values', () => {
      expect(formatNumber(NaN, 'weight-input')).toBe('—')
    })
    it('accepts string values', () => {
      expect(formatNumber('14.82', 'weight-input')).toBe('14.820')
    })
  })

  describe('drift', () => {
    it('formats positive drift with +', () => {
      expect(formatNumber(3.45, 'drift')).toBe('+3.45%')
    })
    it('formats negative drift with -', () => {
      expect(formatNumber(-2.1, 'drift')).toBe('-2.10%')
    })
    it('formats zero drift', () => {
      expect(formatNumber(0, 'drift')).toBe('+0.00%')
    })
  })

  describe('quantity', () => {
    it('formats crypto to 8dp', () => {
      expect(formatNumber(0.001, 'quantity', 'crypto')).toBe('0.00100000')
    })
    it('formats integer stock quantity without decimals', () => {
      expect(formatNumber(100, 'quantity', 'stock')).toBe('100')
    })
    it('formats fractional stock quantity up to 4dp', () => {
      expect(formatNumber(1.5, 'quantity', 'stock')).toBe('1.5')
    })
  })

  describe('staleness', () => {
    it('formats zero as today', () => {
      expect(formatNumber(0, 'staleness')).toBe('today')
    })
    it('formats 1 as 1 day ago', () => {
      expect(formatNumber(1, 'staleness')).toBe('1 day ago')
    })
    it('formats N as N days ago', () => {
      expect(formatNumber(5, 'staleness')).toBe('5 days ago')
    })
  })
})
