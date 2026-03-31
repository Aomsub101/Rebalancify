/**
 * TDD Red Phase — TruncationWarning tests
 * Run with: pnpm test components/simulation/TruncationWarning.test.tsx
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TruncationWarning } from '@/components/simulation/TruncationWarning'

describe('TruncationWarning', () => {
  // AC1: Renders when lookback_months < 36
  it('renders when lookback_months is 8', () => {
    render(<TruncationWarning limiting_ticker="OKLO" lookback_months={8} />)
    expect(screen.getByText(/OKLO/i)).toBeInTheDocument()
    expect(screen.getByText(/8 months/i)).toBeInTheDocument()
    expect(screen.getByText(/limited to a 8-month lookback period/i)).toBeInTheDocument()
  })

  it('renders when lookback_months is 1', () => {
    render(<TruncationWarning limiting_ticker="SPOT" lookback_months={1} />)
    expect(screen.getByText(/SPOT/i)).toBeInTheDocument()
    expect(screen.getByText(/1 months/i)).toBeInTheDocument()
  })

  it('renders when lookback_months is 35 (just under 36)', () => {
    render(<TruncationWarning limiting_ticker="NVDA" lookback_months={35} />)
    expect(screen.getByText(/NVDA/i)).toBeInTheDocument()
    expect(screen.getByText(/35 months/i)).toBeInTheDocument()
  })

  // AC2: Does NOT render when lookback_months >= 36
  it('does NOT render when lookback_months is 36', () => {
    const { container } = render(<TruncationWarning limiting_ticker="AAPL" lookback_months={36} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does NOT render when lookback_months is 40', () => {
    const { container } = render(<TruncationWarning limiting_ticker="AAPL" lookback_months={40} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does NOT render when lookback_months is 60', () => {
    const { container } = render(<TruncationWarning limiting_ticker="MSFT" lookback_months={60} />)
    expect(container).toBeEmptyDOMElement()
  })
})
