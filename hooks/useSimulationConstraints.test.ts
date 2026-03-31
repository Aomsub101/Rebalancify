/**
 * TDD Red Phase — useSimulationConstraints tests
 * Run with: pnpm test hooks/useSimulationConstraints.test.ts
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Holding } from '@/lib/types/holdings'

// Static import — fails at build time during Red phase until hook is created
import { useSimulationConstraints } from '@/hooks/useSimulationConstraints'

// Helper: create a holding with a given asset_created_at date string
function makeHolding(overrides: Partial<Holding> & { asset_created_at: string }): Holding {
  return {
    id: 'h1',
    asset_id: 'a1',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'stock',
    quantity: '10',
    current_price: '150.00',
    current_value: '1500.00',
    current_weight_pct: 50,
    target_weight_pct: 50,
    drift_pct: 0,
    drift_state: 'green',
    drift_breached: false,
    source: 'manual',
    stale_days: 0,
    last_updated_at: new Date().toISOString(),
    // asset_created_at always provided via overrides
    ...overrides,
  }
}

describe('useSimulationConstraints', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Freeze time to 2026-03-31 for deterministic 3-month calculation
    vi.setSystemTime(new Date('2026-03-31T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // AC1: Given 0 holdings → button disabled, "at least 2 assets" tooltip
  it('is disabled when silo has 0 holdings', () => {
    const { result } = renderHook(() => useSimulationConstraints([]))
    expect(result.current.isDisabled).toBe(true)
    expect(result.current.disableReason).toBe('Simulation requires at least 2 assets.')
    expect(result.current.assetCount).toBe(0)
  })

  // AC1: Given 1 holding → button disabled, "at least 2 assets" tooltip
  it('is disabled when silo has 1 holding', () => {
    const holdings = [
      makeHolding({ asset_created_at: '2020-01-01T00:00:00Z' }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(true)
    expect(result.current.disableReason).toBe('Simulation requires at least 2 assets.')
    expect(result.current.assetCount).toBe(1)
  })

  // AC2: Given 2+ holdings but any holding's asset is < 3 months old → disabled, "3 months" tooltip
  it('is disabled when any holding asset is less than 3 months old', () => {
    // AAPL created 4 months ago (old enough)
    // TSLA created 1 month ago (too new)
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2025-11-30T00:00:00Z', // ~4 months ago — old enough
      }),
      makeHolding({
        asset_id: 'a2',
        ticker: 'TSLA',
        asset_created_at: '2026-03-01T00:00:00Z', // ~1 month ago — too new
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(true)
    expect(result.current.disableReason).toBe(
      'Simulation requires all assets to have at least 3 months of trading history.',
    )
    expect(result.current.assetCount).toBe(2)
    expect(result.current.minAgeMet).toBe(false)
  })

  // AC2 variant: exactly 3 months old should be considered old enough
  it('is enabled when youngest asset is exactly 3 months old', () => {
    // Created on 2025-12-31 (exactly 3 months before 2026-03-31) — boundary case
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2025-12-31T00:00:00Z',
      }),
      makeHolding({
        asset_id: 'a2',
        ticker: 'MSFT',
        asset_created_at: '2025-11-01T00:00:00Z',
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(false)
    expect(result.current.minAgeMet).toBe(true)
    expect(result.current.assetCount).toBe(2)
  })

  // AC3: Given 2+ holdings all ≥ 3 months old → button enabled
  it('is enabled when 2+ holdings all have at least 3 months history', () => {
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2025-01-01T00:00:00Z', // Well over 3 months
      }),
      makeHolding({
        asset_id: 'a2',
        ticker: 'MSFT',
        asset_created_at: '2025-06-15T00:00:00Z', // ~9 months ago
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(false)
    expect(result.current.minAgeMet).toBe(true)
    expect(result.current.assetCount).toBe(2)
  })

  // AC2: Single young holding → disabled with 3 months tooltip (takes priority over 2-asset rule since both apply)
  it('disabled reason prefers "3 months" when there are 2+ assets but any is too new', () => {
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2026-01-15T00:00:00Z', // ~2.5 months ago — too new
      }),
      makeHolding({
        asset_id: 'a2',
        ticker: 'MSFT',
        asset_created_at: '2025-01-01T00:00:00Z',
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(true)
    // With 2 assets, the "at least 2 assets" rule is met but "3 months" is not
    expect(result.current.disableReason).toBe(
      'Simulation requires all assets to have at least 3 months of trading history.',
    )
  })

  // Edge: clearly old enough (> 3 months)
  it('is enabled when youngest asset is well over 3 months old', () => {
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2025-11-01T00:00:00Z', // ~5 months ago — clearly valid
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    // With only 1 asset, disabled for min assets regardless of age
    expect(result.current.isDisabled).toBe(true)
    expect(result.current.disableReason).toBe('Simulation requires at least 2 assets.')
  })

  // With 2 assets, clearly old enough → enabled
  it('is enabled when 2+ assets are all well over 3 months old', () => {
    const holdings = [
      makeHolding({
        asset_id: 'a1',
        ticker: 'AAPL',
        asset_created_at: '2025-11-01T00:00:00Z', // ~5 months ago
      }),
      makeHolding({
        asset_id: 'a2',
        ticker: 'MSFT',
        asset_created_at: '2025-10-01T00:00:00Z', // ~6 months ago
      }),
    ]
    const { result } = renderHook(() => useSimulationConstraints(holdings))
    expect(result.current.isDisabled).toBe(false)
    expect(result.current.minAgeMet).toBe(true)
  })
})
