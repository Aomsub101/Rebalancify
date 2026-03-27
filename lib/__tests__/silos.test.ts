import { describe, it, expect, vi } from 'vitest'
import { checkSiloLimit, buildSiloResponse, PLATFORM_DEFAULT_CURRENCY } from '@/lib/silos'
import type { SiloRow } from '@/lib/silos'

// Minimal mock of SupabaseClient select chain for silo count queries
function makeCountClient(count: number) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count, error: null }),
        }),
      }),
    }),
  }
}

const baseSiloRow: SiloRow = {
  id: 'silo-uuid',
  user_id: 'user-uuid',
  name: 'My Portfolio',
  platform_type: 'alpaca',
  base_currency: 'USD',
  drift_threshold: 5.0,
  is_active: true,
  last_synced_at: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

describe('checkSiloLimit', () => {
  it('returns true (limit reached) when active silo count is 5', async () => {
    const client = makeCountClient(5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkSiloLimit(client as any, 'user-uuid')
    expect(result).toBe(true)
  })

  it('returns true (limit reached) when active silo count is greater than 5', async () => {
    const client = makeCountClient(6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkSiloLimit(client as any, 'user-uuid')
    expect(result).toBe(true)
  })

  it('returns false when active silo count is 4', async () => {
    const client = makeCountClient(4)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkSiloLimit(client as any, 'user-uuid')
    expect(result).toBe(false)
  })

  it('returns false when active silo count is 0', async () => {
    const client = makeCountClient(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkSiloLimit(client as any, 'user-uuid')
    expect(result).toBe(false)
  })
})

describe('buildSiloResponse', () => {
  it('returns total_value as "0.00000000" when no holdings exist', () => {
    const result = buildSiloResponse(baseSiloRow, 3, 5)
    expect(result.total_value).toBe('0.00000000')
  })

  it('includes active_silo_count and silo_limit in each response', () => {
    const result = buildSiloResponse(baseSiloRow, 3, 5)
    expect(result.active_silo_count).toBe(3)
    expect(result.silo_limit).toBe(5)
  })

  it('includes weights_sum_pct: 0 and cash_target_pct: 100 when no weights', () => {
    const result = buildSiloResponse(baseSiloRow, 0, 5)
    expect(result.weights_sum_pct).toBe(0)
    expect(result.cash_target_pct).toBe(100)
  })

  it('maps all silo DB fields correctly', () => {
    const result = buildSiloResponse(baseSiloRow, 0, 5)
    expect(result.id).toBe('silo-uuid')
    expect(result.name).toBe('My Portfolio')
    expect(result.platform_type).toBe('alpaca')
    expect(result.base_currency).toBe('USD')
    expect(result.drift_threshold).toBe(5.0)
    expect(result.is_active).toBe(true)
    expect(result.last_synced_at).toBeNull()
  })
})

describe('PLATFORM_DEFAULT_CURRENCY', () => {
  it('returns THB for bitkub', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['bitkub']).toBe('THB')
  })

  it('returns THB for innovestx', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['innovestx']).toBe('THB')
  })

  it('returns USD for alpaca', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['alpaca']).toBe('USD')
  })

  it('returns USD for schwab', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['schwab']).toBe('USD')
  })

  it('returns USD for webull', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['webull']).toBe('USD')
  })

  it('returns USD for manual', () => {
    expect(PLATFORM_DEFAULT_CURRENCY['manual']).toBe('USD')
  })
})
