/**
 * TDD Red Phase — StrategyCard tests
 * Run with: pnpm test components/simulation/StrategyCard.test.tsx
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrategyCard } from '@/components/simulation/StrategyCard'

describe('StrategyCard', () => {
  // AC4: Strategy name display
  it('displays "Not to Lose" for not_to_lose strategy', () => {
    render(
      <StrategyCard
        strategy="not_to_lose"
        weights={{ AAPL: 0.4, TSLA: 0.6 }}
        return_3m="2.34%"
        range="2.34% ± 1.20%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('Not to Lose')).toBeInTheDocument()
  })

  it('displays "Expected" for expected strategy', () => {
    render(
      <StrategyCard
        strategy="expected"
        weights={{ AAPL: 0.5, MSFT: 0.5 }}
        return_3m="4.10%"
        range="4.10% ± 2.00%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('Expected')).toBeInTheDocument()
  })

  it('displays "Optimistic" for optimistic strategy', () => {
    render(
      <StrategyCard
        strategy="optimistic"
        weights={{ TSLA: 1.0 }}
        return_3m="8.50%"
        range="8.50% ± 4.50%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('Optimistic')).toBeInTheDocument()
  })

  // AC4: Weights display format "AAPL: 40.0%, TSLA: 60.0%"
  it('displays ticker: weight% format for not_to_lose', () => {
    render(
      <StrategyCard
        strategy="not_to_lose"
        weights={{ AAPL: 0.4, TSLA: 0.6 }}
        return_3m="2.34%"
        range="2.34% ± 1.20%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('AAPL: 40.0%, TSLA: 60.0%')).toBeInTheDocument()
  })

  it('displays ticker: weight% format for single-asset portfolio', () => {
    render(
      <StrategyCard
        strategy="optimistic"
        weights={{ TSLA: 1.0 }}
        return_3m="8.50%"
        range="8.50% ± 4.50%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('TSLA: 100.0%')).toBeInTheDocument()
  })

  // AC4: Return and range strings
  it('displays return_3m string', () => {
    render(
      <StrategyCard
        strategy="expected"
        weights={{ AAPL: 1.0 }}
        return_3m="4.10%"
        range="4.10% ± 2.00%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('4.10%')).toBeInTheDocument()
  })

  it('displays range string', () => {
    render(
      <StrategyCard
        strategy="expected"
        weights={{ AAPL: 1.0 }}
        return_3m="4.10%"
        range="4.10% ± 2.00%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByText('4.10% ± 2.00%')).toBeInTheDocument()
  })

  // AC4 / AC5: Apply Weights button
  it('has an "Apply Weights" button', () => {
    render(
      <StrategyCard
        strategy="not_to_lose"
        weights={{ AAPL: 0.4, TSLA: 0.6 }}
        return_3m="2.34%"
        range="2.34% ± 1.20%"
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /apply weights/i })).toBeInTheDocument()
  })

  it('calls onApply when Apply Weights is clicked', async () => {
    const onApply = vi.fn()
    render(
      <StrategyCard
        strategy="not_to_lose"
        weights={{ AAPL: 0.4, TSLA: 0.6 }}
        return_3m="2.34%"
        range="2.34% ± 1.20%"
        onApply={onApply}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /apply weights/i }))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  // AC5: StrategyCard itself makes no API call — it only calls the onApply callback
  // The onApply in SimulationResultsTable passes weights to onApplyWeights (no API call there either)
  it('onApply is called without any API network calls', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const onApply = vi.fn()
    render(
      <StrategyCard
        strategy="expected"
        weights={{ AAPL: 0.5, MSFT: 0.5 }}
        return_3m="4.10%"
        range="4.10% ± 2.00%"
        onApply={onApply}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /apply weights/i }))
    expect(onApply).toHaveBeenCalledTimes(1)
    // No fetch calls were made (no API call inside StrategyCard)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
