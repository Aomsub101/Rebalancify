import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRelativeTime } from '../formatRelativeTime'

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-01-15T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('')
  })

  it('returns "just now" for a date less than 60 seconds ago', () => {
    const d = new Date(NOW.getTime() - 30_000) // 30s ago
    expect(formatRelativeTime(d)).toBe('just now')
  })

  it('returns "1 minute ago" for exactly 60 seconds', () => {
    const d = new Date(NOW.getTime() - 60_000)
    expect(formatRelativeTime(d)).toBe('1 minute ago')
  })

  it('returns "X minutes ago" for less than 60 minutes', () => {
    const d = new Date(NOW.getTime() - 15 * 60_000) // 15 min ago
    expect(formatRelativeTime(d)).toBe('15 minutes ago')
  })

  it('returns "1 hour ago" for exactly 60 minutes', () => {
    const d = new Date(NOW.getTime() - 60 * 60_000)
    expect(formatRelativeTime(d)).toBe('1 hour ago')
  })

  it('returns "X hours ago" for less than 24 hours', () => {
    const d = new Date(NOW.getTime() - 5 * 60 * 60_000) // 5h ago
    expect(formatRelativeTime(d)).toBe('5 hours ago')
  })

  it('returns "1 day ago" for exactly 24 hours', () => {
    const d = new Date(NOW.getTime() - 24 * 60 * 60_000)
    expect(formatRelativeTime(d)).toBe('1 day ago')
  })

  it('returns "X days ago" for multiple days', () => {
    const d = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000) // 3 days ago
    expect(formatRelativeTime(d)).toBe('3 days ago')
  })

  it('returns "just now" for a date in the future (defensive)', () => {
    const d = new Date(NOW.getTime() + 5_000) // 5s in future
    expect(formatRelativeTime(d)).toBe('just now')
  })
})
