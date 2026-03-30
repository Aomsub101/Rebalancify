import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PeerCard } from './PeerCard'

describe('PeerCard', () => {
  it('does not show the AI insight text when llmConnected is false', () => {
    render(
      <PeerCard
        peer={{
          ticker: 'MSFT',
          name: 'Microsoft',
          current_price: '1.00000000',
          ai_insight_tag: 'Competitor in enterprise software',
        }}
        llmConnected={false}
      />
    )

    expect(screen.queryByText(/Competitor in enterprise software/i)).not.toBeInTheDocument()
  })
})

