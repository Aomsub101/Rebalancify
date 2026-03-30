import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { embedText } from '@/lib/ragIngest'
import { callLLM } from '@/lib/llmRouter'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn(),
}))
vi.mock('@/lib/ragIngest', () => ({
  embedText: vi.fn(),
}))
vi.mock('@/lib/llmRouter', () => ({
  callLLM: vi.fn(),
}))

describe('POST /api/research/[ticker]', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockReturnThis(),
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('returns 401 if user is not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })
    
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns cached output if valid session exists', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'session_123',
        ticker: 'AAPL',
        llm_provider: 'openai',
        llm_model: 'gpt-4',
        output: { sentiment: 'bullish' },
        created_at: '2026-03-30T00:00:00Z',
      },
    })

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(true)
    expect(body.session_id).toBe('session_123')
  })

  it('returns 403 if no LLM key configured', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null }) // Cache miss
    mockSupabase.single.mockResolvedValueOnce({ data: { llm_key_enc: null } }) // Profile

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('LLM_KEY_MISSING')
  })

  it('calls LLM and stores session on cache miss', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null }) // Cache miss
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { llm_provider: 'openai', llm_model: 'gpt-4', llm_key_enc: 'enc_key' } 
    }) // Profile
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'asset_123' } }) // Asset resolve
    
    ;(decrypt as any).mockReturnValue('plain_key')
    ;(embedText as any).mockResolvedValue([0.1, 0.2])
    mockSupabase.rpc.mockResolvedValueOnce({ data: [{ content: 'rag text', metadata: { title: 'doc1' } }] })
    
    // Mock news context chain
    mockSupabase.contains.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    // For cache check (first single call)
    mockSupabase.single.mockResolvedValueOnce({ data: null }) 
    // For news fetch (last call in chain is limit)
    mockSupabase.limit.mockImplementation((n: number) => {
      if (n === 5) return Promise.resolve({ data: [{ headline: 'news1', summary: 'sum1', source: 'src1', published_at: 'date1' }] })
      return mockSupabase
    })
    
    ;(callLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sentiment: 'bearish',
              confidence: 0.5,
              risk_factors: ['risk1'],
              summary: 'sum',
              relationship_insight: 'Short peer context',
              sources: [],
            }),
          },
        },
      ],
    })

    // For insert result (last call is single)
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new_session_123', created_at: 'date2' } }) 

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(false)
    expect(body.output.sentiment).toBe('bearish')
    expect(body.output.sources).toContain('doc1')
    expect(callLLM).toHaveBeenCalledWith('openai', 'gpt-4', 'plain_key', expect.any(Array))
  })

  it('adds relationship_insight when missing (fallback derived from summary)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null }) // Cache miss
    mockSupabase.single.mockResolvedValueOnce({
      data: { llm_provider: 'openai', llm_model: 'gpt-4', llm_key_enc: 'enc_key' },
    }) // Profile
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'asset_123' } }) // Asset resolve

    ;(decrypt as any).mockReturnValue('plain_key')
    ;(embedText as any).mockResolvedValue([0.1, 0.2])
    mockSupabase.rpc.mockResolvedValueOnce({ data: [] })

    mockSupabase.contains.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockImplementation((n: number) => {
      if (n === 5) return Promise.resolve({ data: [] })
      return mockSupabase
    })

    const summary =
      'This summary should generate a short tag for peers without requiring a dedicated field.'

    ;(callLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sentiment: 'neutral',
              confidence: 0.5,
              risk_factors: ['risk1', 'risk2'],
              summary,
              sources: [],
            }),
          },
        },
      ],
    })

    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new_session_123', created_at: 'date2' } })

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.output.relationship_insight).toBe('string')
    expect(body.output.relationship_insight.length).toBeGreaterThan(0)
  })

  it('returns 422 if LLM output contains allocation percentage recommendation', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null }) // Cache miss
    mockSupabase.single.mockResolvedValueOnce({
      data: { llm_provider: 'openai', llm_model: 'gpt-4', llm_key_enc: 'enc_key' },
    }) // Profile
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'asset_123' } }) // Asset resolve

    ;(decrypt as any).mockReturnValue('plain_key')
    ;(embedText as any).mockResolvedValue([0.1, 0.2])
    mockSupabase.rpc.mockResolvedValueOnce({ data: [] })

    // Mock news context chain
    mockSupabase.contains.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockImplementation((n: number) => {
      if (n === 5) return Promise.resolve({ data: [] })
      return mockSupabase
    })

    ;(callLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sentiment: 'neutral',
              confidence: 0.5,
              risk_factors: ['risk1', 'risk2'],
              summary: 'Allocate 25% to AAPL given the current outlook.',
              relationship_insight: 'Allocation advice is disallowed',
              sources: [],
            }),
          },
        },
      ],
    })

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('LLM_ALLOCATION_OUTPUT')
  })

  it('bypasses cache and inserts refreshed session when { refresh: true }', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })

    // Profile
    mockSupabase.single.mockResolvedValueOnce({
      data: { llm_provider: 'openai', llm_model: 'gpt-4', llm_key_enc: 'enc_key' },
    })

    // Asset resolve
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'asset_123' } })

    ;(decrypt as any).mockReturnValue('plain_key')
    ;(embedText as any).mockResolvedValue([0.1, 0.2])
    mockSupabase.rpc.mockResolvedValueOnce({ data: [] })

    // News fetch
    mockSupabase.contains.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockImplementation((n: number) => {
      if (n === 5) return Promise.resolve({ data: [] })
      return mockSupabase
    })

    ;(callLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sentiment: 'bearish',
              confidence: 0.5,
              risk_factors: ['risk1', 'risk2'],
              summary: 'New research result.',
              relationship_insight: 'Updated view after refresh',
              sources: [],
            }),
          },
        },
      ],
    })

    // Insert result
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'session_new', created_at: 'date_new' } })

    const req = new NextRequest('http://localhost/api/research/AAPL', {
      method: 'POST',
      body: JSON.stringify({ refresh: true }),
    })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(false)
    expect(body.session_id).toBe('session_new')
    expect(callLLM).toHaveBeenCalled()
    expect(mockSupabase.or).not.toHaveBeenCalled()

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_123',
        ticker: 'AAPL',
        refreshed_at: expect.any(String),
      })
    )
  })

  it('returns 502 if LLM provider returns an error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user_123' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null }) // Cache miss
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { llm_provider: 'openai', llm_model: 'gpt-4', llm_key_enc: 'enc_key' } 
    })
    
    ;(decrypt as any).mockReturnValue('plain_key')
    ;(callLLM as any).mockRejectedValue(new Error('API quota exceeded'))

    const req = new NextRequest('http://localhost/api/research/AAPL', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ ticker: 'AAPL' }) })

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('LLM_API_ERROR')
    expect(body.error.message).toBe('API quota exceeded')
  })
})
