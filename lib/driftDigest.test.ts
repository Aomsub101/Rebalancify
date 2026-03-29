/**
 * lib/driftDigest.test.ts
 * TDD tests for drift digest email template builder.
 * Only pure functions are tested here — DB/Resend calls live in the route handler.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDriftDigestHtml,
  escapeHtml,
  type DriftBreachItem,
} from './driftDigest'

const DISCLAIMER = 'This is not financial advice'

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T')
  })

  it('escapes less-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes greater-than', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#39;s")
  })

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('AAPL')).toBe('AAPL')
  })
})

describe('buildDriftDigestHtml', () => {
  const singleItem: DriftBreachItem = {
    siloName: 'US Tech',
    ticker: 'AAPL',
    currentDriftPct: 6.2,
    threshold: 5,
    currentWeightPct: 31.2,
    targetWeightPct: 25.0,
  }

  it('includes the disclaimer text', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain(DISCLAIMER)
  })

  it('includes ticker in output', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain('AAPL')
  })

  it('includes silo name in output', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain('US Tech')
  })

  it('includes drift percentage in output', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain('6.2')
  })

  it('includes threshold in output', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain('5')
  })

  it('renders all items when multiple are given', () => {
    const items: DriftBreachItem[] = [
      singleItem,
      {
        siloName: 'Crypto Bag',
        ticker: 'BTC',
        currentDriftPct: 8.1,
        threshold: 5,
        currentWeightPct: 43.1,
        targetWeightPct: 35.0,
      },
    ]
    const html = buildDriftDigestHtml(items)
    expect(html).toContain('AAPL')
    expect(html).toContain('BTC')
    expect(html).toContain('Crypto Bag')
  })

  it('renders gracefully for empty items list', () => {
    const html = buildDriftDigestHtml([])
    expect(html).toContain(DISCLAIMER)
    // Should not throw and should still contain structure
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('escapes HTML special characters in silo name', () => {
    const item: DriftBreachItem = {
      ...singleItem,
      siloName: '<script>alert(1)</script>',
    }
    const html = buildDriftDigestHtml([item])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML special characters in ticker', () => {
    const item: DriftBreachItem = {
      ...singleItem,
      ticker: 'A&B',
    }
    const html = buildDriftDigestHtml([item])
    expect(html).not.toContain('A&B')
    expect(html).toContain('A&amp;B')
  })

  it('includes current and target weight percentages', () => {
    const html = buildDriftDigestHtml([singleItem])
    expect(html).toContain('31.2')
    expect(html).toContain('25.0')
  })
})
