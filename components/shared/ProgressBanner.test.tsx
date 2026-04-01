/**
 * ProgressBanner tests — STORY-028
 * Tests step completion states and dismiss flow.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProgressBanner } from './ProgressBanner'

const mockRefreshProfile = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    refreshProfile: mockRefreshProfile,
  }),
}))

// Mock useQuery to return controlled data per test
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: string[] }) => mockUseQuery(opts),
}))

function setupQueries({
  silos = [{ id: 'silo-1', total_value: '0.00000000', weights_sum_pct: 0 }],
  holdings = [] as { id: string }[],
  history = [] as { id: string }[],
} = {}) {
  mockUseQuery.mockImplementation((opts: { queryKey: string[] }) => {
    const key = opts.queryKey[0]
    if (key === 'silos') return { data: silos }
    if (key === 'holdings') return { data: holdings }
    if (key === 'rebalance-history') return { data: history }
    return { data: undefined }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  })
})

describe('ProgressBanner', () => {
  it('renders all three step labels', () => {
    setupQueries()
    render(<ProgressBanner />)
    expect(screen.getByText('Add holdings')).toBeInTheDocument()
    expect(screen.getByText('Set target weights')).toBeInTheDocument()
    expect(screen.getByText('Run first rebalance')).toBeInTheDocument()
  })

  it('step 1 shows as complete when holdings exist', () => {
    setupQueries({ holdings: [{ id: 'h-1' }] })
    render(<ProgressBanner />)
    // sr-only span announces completion — reliable regardless of SVG rendering
    expect(screen.getAllByText('(complete)')[0]).toBeInTheDocument()
  })

  it('step 2 shows as complete when weights_sum_pct > 0', () => {
    setupQueries({
      silos: [{ id: 'silo-1', total_value: '1000.00000000', weights_sum_pct: 95 }],
      holdings: [{ id: 'h-1' }],
    })
    render(<ProgressBanner />)
    const completes = screen.getAllByText('(complete)')
    expect(completes.length).toBeGreaterThanOrEqual(2)
  })

  it('step 3 shows as complete when history exists', () => {
    setupQueries({
      silos: [{ id: 'silo-1', total_value: '1000.00000000', weights_sum_pct: 95 }],
      holdings: [{ id: 'h-1' }],
      history: [{ id: 'session-1' }],
    })
    render(<ProgressBanner />)
    expect(screen.getAllByText('(complete)').length).toBe(3)
  })

  // Test: progress banner dismiss persists — PATCH called and refreshProfile invoked
  it('AC-8: dismiss button calls PATCH progress_banner_dismissed=true', async () => {
    setupQueries()
    mockRefreshProfile.mockResolvedValue(undefined)

    render(<ProgressBanner />)
    fireEvent.click(screen.getByRole('button', { name: /Dismiss progress banner/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ progress_banner_dismissed: true }),
        }),
      )
      expect(mockRefreshProfile).toHaveBeenCalled()
    })
  })
})
