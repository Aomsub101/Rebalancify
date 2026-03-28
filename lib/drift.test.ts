import { describe, it, expect } from 'vitest'
import { computeDriftState } from './drift'

describe('computeDriftState', () => {
  // AC3: Green: ABS(drift_pct) <= drift_threshold
  it('returns green for zero drift', () => {
    expect(computeDriftState(0, 5)).toBe('green')
  })

  it('returns green when ABS exactly equals threshold', () => {
    expect(computeDriftState(5, 5)).toBe('green')
  })

  it('returns green when ABS is below threshold', () => {
    expect(computeDriftState(4.9, 5)).toBe('green')
  })

  it('returns green for negative drift within threshold', () => {
    expect(computeDriftState(-5, 5)).toBe('green')
  })

  // AC3: Yellow: threshold < ABS <= threshold + 2
  it('returns yellow when ABS is just above threshold', () => {
    expect(computeDriftState(5.1, 5)).toBe('yellow')
  })

  it('returns yellow when ABS equals threshold + 2', () => {
    expect(computeDriftState(7, 5)).toBe('yellow')
  })

  it('returns yellow for negative drift in yellow zone', () => {
    expect(computeDriftState(-6, 5)).toBe('yellow')
  })

  // AC3: Red: ABS > threshold + 2
  it('returns red when ABS is just above threshold + 2', () => {
    expect(computeDriftState(7.001, 5)).toBe('red')
  })

  it('returns red for large positive drift', () => {
    expect(computeDriftState(20, 5)).toBe('red')
  })

  it('returns red for large negative drift', () => {
    expect(computeDriftState(-7.1, 5)).toBe('red')
  })

  // AC4: Custom threshold
  it('uses custom threshold correctly — green zone', () => {
    expect(computeDriftState(2.9, 3)).toBe('green')
  })

  it('uses custom threshold correctly — yellow zone', () => {
    expect(computeDriftState(3.5, 3)).toBe('yellow')
  })

  it('uses custom threshold correctly — red zone', () => {
    expect(computeDriftState(5.1, 3)).toBe('red')
  })
})
