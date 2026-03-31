/**
 * SimulateScenariosButton tests — STORY-042
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Holding } from '@/lib/types/holdings'
import { SimulateScenariosButton } from '@/components/simulation/SimulateScenariosButton'

// Helper: minimal holding with asset_created_at
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
    ...overrides,
  }
}

const OLD_ENOUGH = '2020-01-01T00:00:00Z' // Well over 3 months

describe('SimulateScenariosButton', () => {
  // AC1: 0 or 1 holdings → button disabled with "at least 2 assets" tooltip
  it('is disabled with 0 holdings', () => {
    render(<SimulateScenariosButton holdings={[]} onSimulate={vi.fn()} isLoading={false} />)
    expect(screen.getByRole('button', { name: /simulate scenarios/i })).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Simulation requires at least 2 assets.',
    )
  })

  it('is disabled with 1 holding', () => {
    render(
      <SimulateScenariosButton
        holdings={[makeHolding({ asset_created_at: OLD_ENOUGH })]}
        onSimulate={vi.fn()}
        isLoading={false}
      />,
    )
    expect(screen.getByRole('button', { name: /simulate scenarios/i })).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Simulation requires at least 2 assets.',
    )
  })

  // AC2: 2+ holdings but any asset < 3 months old → disabled with "3 months" tooltip
  it('is disabled when youngest asset is less than 3 months old', () => {
    const youngDate = new Date()
    youngDate.setMonth(youngDate.getMonth() - 1)
    const youngAssetCreatedAt = youngDate.toISOString()

    render(
      <SimulateScenariosButton
        holdings={[
          makeHolding({ ticker: 'AAPL', asset_created_at: OLD_ENOUGH }),
          makeHolding({ ticker: 'TSLA', asset_id: 'a2', asset_created_at: youngAssetCreatedAt }),
        ]}
        onSimulate={vi.fn()}
        isLoading={false}
      />,
    )
    expect(screen.getByRole('button', { name: /simulate scenarios/i })).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Simulation requires all assets to have at least 3 months of trading history.',
    )
  })

  // AC3: 2+ holdings all ≥ 3 months → button enabled
  it('is enabled with 2+ holdings all over 3 months old', () => {
    render(
      <SimulateScenariosButton
        holdings={[
          makeHolding({ ticker: 'AAPL', asset_created_at: OLD_ENOUGH }),
          makeHolding({ ticker: 'MSFT', asset_id: 'a2', asset_created_at: OLD_ENOUGH }),
        ]}
        onSimulate={vi.fn()}
        isLoading={false}
      />,
    )
    expect(screen.getByRole('button', { name: /simulate scenarios/i })).toBeEnabled()
    // When enabled, no tooltip (title attribute absent)
    expect(screen.getByRole('button').getAttribute('title')).toBeNull()
  })

  // AC4: Loading state shows spinner and button is disabled
  it('shows spinner and is disabled while loading', () => {
    render(
      <SimulateScenariosButton
        holdings={[
          makeHolding({ ticker: 'AAPL', asset_created_at: OLD_ENOUGH }),
          makeHolding({ ticker: 'MSFT', asset_id: 'a2', asset_created_at: OLD_ENOUGH }),
        ]}
        onSimulate={vi.fn()}
        isLoading={true}
      />,
    )
    expect(screen.getByRole('button', { name: /simulating/i })).toBeDisabled()
  })

  // AC4: Clicking enabled button calls onSimulate
  it('calls onSimulate when clicked (enabled button)', () => {
    const onSimulate = vi.fn()
    render(
      <SimulateScenariosButton
        holdings={[
          makeHolding({ ticker: 'AAPL', asset_created_at: OLD_ENOUGH }),
          makeHolding({ ticker: 'MSFT', asset_id: 'a2', asset_created_at: OLD_ENOUGH }),
        ]}
        onSimulate={onSimulate}
        isLoading={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /simulate scenarios/i }))
    expect(onSimulate).toHaveBeenCalledTimes(1)
  })

  // AC4: Clicking disabled button does NOT call onSimulate
  it('does not call onSimulate when disabled', () => {
    const onSimulate = vi.fn()
    render(<SimulateScenariosButton holdings={[]} onSimulate={onSimulate} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /simulate scenarios/i }))
    expect(onSimulate).not.toHaveBeenCalled()
  })
})
