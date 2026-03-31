/**
 * TDD Red Phase — SimulationResultsTable tests
 * Run with: pnpm test components/simulation/SimulationResultsTable.test.tsx
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SimulationResultsTable } from '@/components/simulation/SimulationResultsTable'
import type { SimulationResult } from '@/lib/types/simulation'
import type { Holding } from '@/lib/types/holdings'

function makeHolding(overrides: Partial<Holding> & { asset_id: string; ticker: string }): Holding {
  // Spread overrides first so explicit defaults overwrite any conflicting overrides keys
  return {
    ...overrides,
    id: overrides.id ?? 'h1',
    name: overrides.name ?? 'Apple Inc.',
    asset_type: overrides.asset_type ?? 'stock',
    quantity: overrides.quantity ?? '10',
    current_price: overrides.current_price ?? '150.00',
    current_value: overrides.current_value ?? '1500.00',
    current_weight_pct: overrides.current_weight_pct ?? 50,
    target_weight_pct: overrides.target_weight_pct ?? 50,
    drift_pct: overrides.drift_pct ?? 0,
    drift_state: overrides.drift_state ?? 'green',
    drift_breached: overrides.drift_breached ?? false,
    source: overrides.source ?? 'manual',
    stale_days: overrides.stale_days ?? 0,
    last_updated_at: overrides.last_updated_at ?? new Date().toISOString(),
  }
}

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    strategies: {
      not_to_lose: { weights: { AAPL: 0.6, TSLA: 0.4 }, return_3m: '1.80%', range: '1.80% ± 0.90%' },
      expected: { weights: { AAPL: 0.5, TSLA: 0.5 }, return_3m: '3.20%', range: '3.20% ± 1.60%' },
      optimistic: { weights: { AAPL: 0.2, TSLA: 0.8 }, return_3m: '6.10%', range: '6.10% ± 3.50%' },
    },
    metadata: {
      is_truncated_below_3_years: false,
      limiting_ticker: 'AAPL',
      lookback_months: 40,
    },
    ...overrides,
  }
}

const HOLDINGS = [
  makeHolding({ asset_id: 'a1', ticker: 'AAPL' }),
  makeHolding({ id: 'h2', asset_id: 'a2', ticker: 'TSLA' }),
]

describe('SimulationResultsTable', () => {
  // AC7: Renders 3 StrategyCards in correct order
  it('renders 3 StrategyCards', () => {
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={vi.fn()} />)
    expect(screen.getByText('Not to Lose')).toBeInTheDocument()
    expect(screen.getByText('Expected')).toBeInTheDocument()
    expect(screen.getByText('Optimistic')).toBeInTheDocument()
  })

  it('renders strategy cards in correct order: Not to Lose → Expected → Optimistic', () => {
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={vi.fn()} />)
    const texts = ['Not to Lose', 'Expected', 'Optimistic']
    const nodes = screen.getAllByText(text => texts.includes(text))
    expect(nodes[0]).toHaveTextContent('Not to Lose')
    expect(nodes[1]).toHaveTextContent('Expected')
    expect(nodes[2]).toHaveTextContent('Optimistic')
  })

  // AC3: SimulationDisclaimer is visible and has no close/dismiss button
  it('renders SimulationDisclaimer', () => {
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={vi.fn()} />)
    expect(
      screen.getByText(/simulation results are based on historical data/i),
    ).toBeInTheDocument()
  })

  it('SimulationDisclaimer has no close/dismiss button in DOM', () => {
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={vi.fn()} />)
    const dismissButtons = screen.queryAllByRole('button', { name: /close|dismiss|cancel/i })
    expect(dismissButtons).toHaveLength(0)
  })

  // AC1: TruncationWarning renders when lookback_months = 8
  it('renders TruncationWarning when lookback_months = 8', () => {
    render(
      <SimulationResultsTable
        result={makeResult({ metadata: { is_truncated_below_3_years: true, limiting_ticker: 'OKLO', lookback_months: 8 } })}
        holdings={HOLDINGS}
        onApplyWeights={vi.fn()}
      />,
    )
    expect(screen.getByText(/OKLO/i)).toBeInTheDocument()
    expect(screen.getByText(/8 months/i)).toBeInTheDocument()
  })

  // AC2: TruncationWarning does NOT render when lookback_months = 40
  it('does NOT render TruncationWarning when lookback_months = 40', () => {
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={vi.fn()} />)
    expect(screen.queryByText(/limited to a 40-month lookback period/i)).not.toBeInTheDocument()
  })

  it('does NOT render TruncationWarning when lookback_months = 36', () => {
    render(
      <SimulationResultsTable
        result={makeResult({ metadata: { is_truncated_below_3_years: false, limiting_ticker: 'AAPL', lookback_months: 36 } })}
        holdings={HOLDINGS}
        onApplyWeights={vi.fn()}
      />,
    )
    expect(screen.queryByText(/limited to a 36-month lookback period/i)).not.toBeInTheDocument()
  })

  // AC5: Apply Weights does NOT fire any API call
  it('Apply Weights does not call any API', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const onApplyWeights = vi.fn()
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={onApplyWeights} />)

    // Click Apply Weights on the first strategy card
    const applyButtons = screen.getAllByRole('button', { name: /apply weights/i })
    applyButtons[0].click()

    // Verify no fetch calls were made
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  // AC5: Apply Weights calls onApplyWeights with correct weights
  it('calls onApplyWeights with ticker-keyed weights when Apply is clicked', () => {
    const onApplyWeights = vi.fn()
    render(<SimulationResultsTable result={makeResult()} holdings={HOLDINGS} onApplyWeights={onApplyWeights} />)

    const applyButtons = screen.getAllByRole('button', { name: /apply weights/i })
    applyButtons[0].click() // Apply Not to Lose

    expect(onApplyWeights).toHaveBeenCalledTimes(1)
    // not_to_lose weights are { AAPL: 0.6, TSLA: 0.4 }
    // These are ticker-keyed; the caller converts to asset_id
    expect(onApplyWeights).toHaveBeenCalledWith({ AAPL: 0.6, TSLA: 0.4 })
  })
})
