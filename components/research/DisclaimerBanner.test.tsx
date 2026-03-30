import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DisclaimerBanner } from './DisclaimerBanner'

describe('DisclaimerBanner', () => {
  it('does not render any dismiss/close control', () => {
    render(<DisclaimerBanner />)
    expect(
      screen.getByText(/Nothing on this page constitutes financial advice/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })
})

