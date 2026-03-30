import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/ragIngest'
import { parsePdf } from '@/lib/pdfParser'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/ragIngest', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    embedText: vi.fn(),
  }
})

vi.mock('@/lib/pdfParser', () => ({
  parsePdf: vi.fn(),
}))

describe('POST /api/knowledge/upload', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.EMBEDDING_API_KEY = 'test-key'
    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase)
    vi.mocked(embedText).mockResolvedValue(new Array(1536).fill(0.1))
  })

  it('returns 401 if unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth' } })
    const req = new Request('http://localhost/api/knowledge/upload', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 if no file is provided', async () => {
    const formData = new FormData()
    const req = new Request('http://localhost/api/knowledge/upload', {
      method: 'POST',
    })
    req.formData = async () => formData
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 if file type is unsupported', async () => {
    const formData = new FormData()
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    formData.append('file', file)
    const req = new Request('http://localhost/api/knowledge/upload', {
      method: 'POST',
    })
    req.formData = async () => formData
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('processes a markdown file successfully', async () => {
    const formData = new FormData()
    const mdContent = '# Title\n\n## Section 1\nContent 1\n## Section 2\nContent 2'
    const file = new File([mdContent], 'test.md', { type: 'text/markdown' })
    formData.append('file', file)
    const req = new Request('http://localhost/api/knowledge/upload', {
      method: 'POST',
    })
    req.formData = async () => formData
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.chunks_inserted).toBe(2)
    expect(embedText).toHaveBeenCalledTimes(2)
    expect(mockSupabase.upsert).toHaveBeenCalledTimes(2)
    
    // Verify metadata source is upload
    const upsertArgs = mockSupabase.upsert.mock.calls[0][0]
    expect(upsertArgs.metadata.source).toBe('upload')
  })

  it('processes a PDF file successfully', async () => {
    vi.mocked(parsePdf).mockResolvedValueOnce('# PDF Title\n\n## PDF Section\nPDF Content')
    const formData = new FormData()
    const file = new File(['dummy-pdf'], 'test.pdf', { type: 'application/pdf' })
    formData.append('file', file)
    const req = new Request('http://localhost/api/knowledge/upload', {
      method: 'POST',
    })
    req.formData = async () => formData
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.chunks_inserted).toBe(1)
    expect(parsePdf).toHaveBeenCalledTimes(1)
  })

  it('returns 422 if PDF parsing fails', async () => {
    vi.mocked(parsePdf).mockRejectedValueOnce(new Error('Parse error'))
    const formData = new FormData()
    const file = new File(['dummy-pdf'], 'test.pdf', { type: 'application/pdf' })
    formData.append('file', file)
    const req = new Request('http://localhost/api/knowledge/upload', {
      method: 'POST',
    })
    req.formData = async () => formData
    const res = await POST(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.code).toBe('PDF_PARSE_ERROR')
  })
})
