import { describe, it, expect, vi } from 'vitest'
import { parsePdf } from './pdfParser'
import { PDFParse } from 'pdf-parse'

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn(),
}))

describe('pdfParser', () => {
  it('parses a valid PDF buffer and returns the text', async () => {
    const mockGetText = vi.fn().mockResolvedValue({ text: 'Mocked PDF text' })
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: mockGetText,
    } as any))
    
    const buffer = Buffer.from('dummy-pdf-content')
    const text = await parsePdf(buffer)
    
    expect(PDFParse).toHaveBeenCalledWith({ data: buffer })
    expect(mockGetText).toHaveBeenCalled()
    expect(text).toBe('Mocked PDF text')
  })

  it('throws an error if parsing fails', async () => {
    const mockGetText = vi.fn().mockRejectedValue(new Error('Parse failed'))
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: mockGetText,
    } as any))
    
    const buffer = Buffer.from('invalid-pdf')
    await expect(parsePdf(buffer)).rejects.toThrow('Parse failed')
  })
})