/**
 * OnboardingGate tests — STORY-028
 * Tests that the modal/banner appear and disappear based on profile state.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingGate } from './OnboardingGate'

// Mock child components to isolate gate logic
vi.mock('./OnboardingModal', () => ({
  OnboardingModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="onboarding-modal" /> : null,
}))
vi.mock('./ProgressBanner', () => ({
  ProgressBanner: () => <div data-testid="progress-banner" />,
}))

// Shared mock — overridden per test
const mockSession = vi.fn()
vi.mock('@/contexts/SessionContext', () => ({
  useSession: () => mockSession(),
}))

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    onboarded: false,
    siloCount: 0,
    progressBannerDismissed: false,
    isLoading: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingGate', () => {
  // Test: modal shown on first login (not onboarded + no silos)
  it('shows the modal when not onboarded and no silos', () => {
    mockSession.mockReturnValue(makeSession({ onboarded: false, siloCount: 0 }))
    render(<OnboardingGate />)
    expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('progress-banner')).not.toBeInTheDocument()
  })

  // Test: modal not shown on second login (already onboarded)
  it('does not show the modal when already onboarded', () => {
    mockSession.mockReturnValue(makeSession({ onboarded: true, siloCount: 1 }))
    render(<OnboardingGate />)
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument()
  })

  // Test: skip → no modal shown (onboarded=true, siloCount=0 → no banner either)
  it('does not show modal after skip (onboarded=true, no silos)', () => {
    mockSession.mockReturnValue(makeSession({ onboarded: true, siloCount: 0 }))
    render(<OnboardingGate />)
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument()
    // Banner also hidden: no silos
    expect(screen.queryByTestId('progress-banner')).not.toBeInTheDocument()
  })

  // Test: progress banner appears after silo creation
  it('shows progress banner when onboarded, has silo, not dismissed', () => {
    mockSession.mockReturnValue(
      makeSession({ onboarded: true, siloCount: 1, progressBannerDismissed: false }),
    )
    render(<OnboardingGate />)
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-banner')).toBeInTheDocument()
  })

  // Test: progress banner dismiss persists (dismissed=true → banner hidden)
  it('hides progress banner after dismiss (progress_banner_dismissed=true)', () => {
    mockSession.mockReturnValue(
      makeSession({ onboarded: true, siloCount: 1, progressBannerDismissed: true }),
    )
    render(<OnboardingGate />)
    expect(screen.queryByTestId('progress-banner')).not.toBeInTheDocument()
  })

  // Test: nothing rendered while auth is loading
  it('renders nothing while isLoading=true', () => {
    mockSession.mockReturnValue(makeSession({ isLoading: true }))
    const { container } = render(<OnboardingGate />)
    expect(container.firstChild).toBeNull()
  })
})
