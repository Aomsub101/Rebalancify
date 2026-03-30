import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LLMKeyGate } from './LLMKeyGate'

describe('LLMKeyGate', () => {
  it('shows the expected gate message', () => {
    render(<LLMKeyGate />)
    expect(
      screen.getByText(/To use the Research Hub, add your LLM API key in Settings\./i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Settings/i })).toBeInTheDocument()
  })
})

