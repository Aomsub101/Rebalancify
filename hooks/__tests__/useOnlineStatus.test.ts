import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '../useOnlineStatus'

// Mock the Cache API
const mockCaches = {
  open: vi.fn(),
  keys: vi.fn(),
  match: vi.fn(),
}

describe('useOnlineStatus', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(window, 'navigator')

  beforeEach(() => {
    // Default: online
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { onLine: true },
    })
    // No cache API by default
    // @ts-expect-error - deleting global for test isolation
    delete (window as Window & { caches?: unknown }).caches
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(window, 'navigator', originalNavigator)
    }
  })

  it('returns isOnline=true when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.isOnline).toBe(true)
  })

  it('returns isOnline=false when navigator.onLine is false', () => {
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { onLine: false },
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.isOnline).toBe(false)
  })

  it('transitions to offline when offline event fires', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.isOnline).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)
  })

  it('transitions to online when online event fires', () => {
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { onLine: false },
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.isOnline).toBe(false)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
  })

  it('returns cachedAt=null when Cache API is not available', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.cachedAt).toBeNull()
  })

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOnlineStatus())
    unmount()
    const onlineAdds = addSpy.mock.calls.filter(c => c[0] === 'online').length
    const offlineAdds = addSpy.mock.calls.filter(c => c[0] === 'offline').length
    const onlineRemovals = removeSpy.mock.calls.filter(c => c[0] === 'online').length
    const offlineRemovals = removeSpy.mock.calls.filter(c => c[0] === 'offline').length
    expect(onlineRemovals).toBe(onlineAdds)
    expect(offlineRemovals).toBe(offlineAdds)
  })

  it('reads cachedAt from Cache API date headers when available', async () => {
    const cachedDate = new Date('2026-01-15T10:00:00Z')
    const mockResponse = {
      headers: {
        get: (name: string) => (name === 'date' ? cachedDate.toUTCString() : null),
      },
    }
    const mockCache = {
      keys: vi.fn().mockResolvedValue([new Request('http://localhost/api/silos')]),
      match: vi.fn().mockResolvedValue(mockResponse),
    }
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    })

    const { result } = renderHook(() => useOnlineStatus())
    // Wait for async cache read
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(result.current.cachedAt).not.toBeNull()
  })
})
