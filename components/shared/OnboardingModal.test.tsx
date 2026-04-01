/**
 * OnboardingModal tests — STORY-028
 * Tests platform card selection, non-dismissibility, skip flow, create flow.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingModal } from './OnboardingModal'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockRefreshProfile = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshProfile: mockRefreshProfile,
  }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

// Stub Dialog to render children directly (shadcn uses Radix Portal which needs JSDOM setup)
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, onEscapeKeyDown, onInteractOutside }: {
    children: React.ReactNode
    onEscapeKeyDown?: (e: unknown) => void
    onInteractOutside?: (e: unknown) => void
  }) => (
    <div
      data-testid="dialog-content"
      data-escape-handler={!!onEscapeKeyDown}
      data-outside-handler={!!onInteractOutside}
    >
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('OnboardingModal', () => {
  it('renders nothing when open=false', () => {
    render(<OnboardingModal open={false} />)
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('renders all 7 platform options when open=true', () => {
    render(<OnboardingModal open={true} />)
    expect(screen.getByRole('button', { name: /Alpaca/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /BITKUB/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /InnovestX/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Schwab/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Webull/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /DIME/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Other platform/i })).toBeInTheDocument()
  })

  it('AC-10: dialog has ESC and backdrop-click handlers to prevent dismissal', () => {
    render(<OnboardingModal open={true} />)
    const content = screen.getByTestId('dialog-content')
    expect(content.dataset.escapeHandler).toBe('true')
    expect(content.dataset.outsideHandler).toBe('true')
  })

  it('Create silo button is disabled when no platform selected', () => {
    render(<OnboardingModal open={true} />)
    const createBtn = screen.getByRole('button', { name: /Create silo/i })
    expect(createBtn).toBeDisabled()
  })

  it('enables Create silo after selecting a platform', () => {
    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Alpaca/i }))
    expect(screen.getByRole('button', { name: /Create silo/i })).not.toBeDisabled()
  })

  it('shows name input when Other is selected', () => {
    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Other platform/i }))
    expect(screen.getByPlaceholderText(/My Brokerage/i)).toBeInTheDocument()
  })

  it('Create silo disabled for Other until name entered', () => {
    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Other platform/i }))
    expect(screen.getByRole('button', { name: /Create silo/i })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/My Brokerage/i), {
      target: { value: 'My Platform' },
    })
    expect(screen.getByRole('button', { name: /Create silo/i })).not.toBeDisabled()
  })

  it('AC-3: POSTs correct payload for Alpaca', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/silos') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'silo-abc' }),
        })
      }
      // PATCH /api/profile
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
    global.fetch = mockFetch
    mockRefreshProfile.mockResolvedValue(undefined)

    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Alpaca/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create silo/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/silos',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Alpaca Portfolio', platform_type: 'alpaca', base_currency: 'USD' }),
        }),
      )
    })
  })

  it('AC-3: POSTs correct payload for DIME (manual platform)', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/silos') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'silo-dime' }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    global.fetch = mockFetch
    mockRefreshProfile.mockResolvedValue(undefined)

    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /DIME/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create silo/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/silos',
        expect.objectContaining({
          body: JSON.stringify({ name: 'DIME', platform_type: 'manual', base_currency: 'THB' }),
        }),
      )
    })
  })

  it('AC-4: navigates to new silo after creation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'silo-new' }),
    })
    mockRefreshProfile.mockResolvedValue(undefined)

    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Alpaca/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create silo/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/silos/silo-new')
    })
  })

  it('AC-5: Skip calls PATCH onboarded=true and refreshes profile', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    mockRefreshProfile.mockResolvedValue(undefined)

    render(<OnboardingModal open={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ onboarded: true }),
        }),
      )
      expect(mockRefreshProfile).toHaveBeenCalled()
    })
  })
})
