import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchHubClient } from './ResearchHubClient'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

function makeLongSummary() {
  const words = Array.from({ length: 350 }).map((_, i) => `word${i}`)
  words[349] = 'finalWord'
  return words.join(' ')
}

describe('ResearchHubClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('allows expanding summary while refresh is in-flight', async () => {
    const summary = makeLongSummary()

    const initialResponse = {
      session_id: 's1',
      ticker: 'AAPL',
      cached: true,
      output: {
        sentiment: 'neutral',
        confidence: 0.5,
        risk_factors: ['r1', 'r2'],
        summary,
        sources: ['src1'],
      },
      created_at: '2026-03-30T00:00:00Z',
    }

    let resolveRefresh: ((v: any) => void) | undefined
    const refreshPromise: Promise<any> = new Promise((resolve) => {
      resolveRefresh = resolve as (v: any) => void
    })

    const fetchMock = vi
      .spyOn(global, 'fetch')
      // Initial load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialResponse,
      } as any)
      // Refresh call (pending)
      .mockImplementationOnce(async () => {
        const body = await refreshPromise
        return {
          ok: true,
          json: async () => body,
        } as any
      })

    render(
      wrap(<ResearchHubClient ticker="AAPL" companyName="Apple" llmConnected={true} />)
    )

    // Wait for truncated view button to appear
    const showMore = await screen.findByRole('button', { name: /Show more summary/i })

    // Trigger refresh (in-flight)
    fireEvent.click(screen.getByRole('button', { name: /Refresh research/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    // Expand summary while refresh pending
    fireEvent.click(showMore)
    await waitFor(() => {
      expect(screen.getByText(/finalWord/)).toBeInTheDocument()
    })

    // Resolve refresh to avoid dangling promise
    if (resolveRefresh) {
      resolveRefresh({
        ...initialResponse,
        cached: false,
        created_at: '2026-03-30T00:01:00Z',
      })
    }
  })
})

