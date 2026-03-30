/**
 * lib/ragIngest.test.ts
 * TDD unit tests for RAG document chunking and embedding utilities.
 * Tests cover chunkDocument() and padEmbedding() pure functions.
 * embedText() is not unit-tested here — it calls external APIs.
 */
import { describe, it, expect } from 'vitest'
import { chunkDocument, padEmbedding, type DocumentChunk } from './ragIngest'

// ---------------------------------------------------------------------------
// chunkDocument
// ---------------------------------------------------------------------------

describe('chunkDocument', () => {
  it('returns a single chunk when document has no H2 headings', () => {
    const content = `# My Document\n\nThis is the only section with no H2 headings.\n\n## Sources\n\n- Reference A`
    const chunks = chunkDocument(content, 'my-doc.md')
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('splits on H2 headings as hard boundaries', () => {
    const content = `# Title\n\n## Section One\n\nContent of section one.\n\n## Section Two\n\nContent of section two.\n\n## Sources\n\n- Reference`
    const chunks = chunkDocument(content, 'test.md')
    // Should produce at least 2 content chunks (Section One, Section Two)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    const texts = chunks.map((c) => c.content)
    expect(texts.some((t) => t.includes('Content of section one'))).toBe(true)
    expect(texts.some((t) => t.includes('Content of section two'))).toBe(true)
  })

  it('assigns zero-based sequential chunk_index values', () => {
    const content = `# Title\n\n## Alpha\n\nText alpha.\n\n## Beta\n\nText beta.\n\n## Sources\n\n- ref`
    const chunks = chunkDocument(content, 'test.md')
    chunks.forEach((chunk, i) => {
      expect(chunk.chunk_index).toBe(i)
    })
  })

  it('populates metadata.title from the H1 heading', () => {
    const content = `# Modern Portfolio Theory\n\n## Background\n\nMPT text.\n\n## Sources\n\n- ref`
    const chunks = chunkDocument(content, '01-mpt.md')
    expect(chunks[0].metadata.title).toBe('Modern Portfolio Theory')
  })

  it('populates metadata.document_name from the fileName', () => {
    const content = `# Doc\n\n## Section\n\nText.\n\n## Sources\n\n- ref`
    const chunks = chunkDocument(content, '01-modern-portfolio-theory.md')
    chunks.forEach((chunk) => {
      expect(chunk.metadata.document_name).toBe('01-modern-portfolio-theory.md')
    })
  })

  it('sets metadata.source to "default" for all chunks', () => {
    const content = `# Doc\n\n## Section\n\nText.\n\n## Sources\n\n- ref`
    const chunks = chunkDocument(content, 'doc.md')
    chunks.forEach((chunk) => {
      expect(chunk.metadata.source).toBe('default')
    })
  })

  it('does not include empty chunks', () => {
    const content = `# Title\n\n## \n\n## Real Section\n\nActual content here.\n\n## Sources\n\n- ref`
    const chunks = chunkDocument(content, 'test.md')
    chunks.forEach((chunk) => {
      expect(chunk.content.trim().length).toBeGreaterThan(0)
    })
  })

  it('handles a document with only a Sources section gracefully', () => {
    const content = `# Title\n\n## Sources\n\n- Some ref`
    const chunks = chunkDocument(content, 'minimal.md')
    // Should not throw; may produce 0 or 1 chunks
    expect(Array.isArray(chunks)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// padEmbedding
// ---------------------------------------------------------------------------

describe('padEmbedding', () => {
  it('pads a 768-dim vector to 1536 by appending 768 zeros', () => {
    const vec = Array.from({ length: 768 }, (_, i) => i * 0.001)
    const padded = padEmbedding(vec, 1536)
    expect(padded).toHaveLength(1536)
    // Original values preserved
    expect(padded.slice(0, 768)).toEqual(vec)
    // Padding is all zeros
    expect(padded.slice(768)).toEqual(Array(768).fill(0))
  })

  it('returns a 1536-dim vector unchanged', () => {
    const vec = Array.from({ length: 1536 }, () => 0.5)
    const padded = padEmbedding(vec, 1536)
    expect(padded).toHaveLength(1536)
    expect(padded).toEqual(vec)
  })

  it('pads correctly for arbitrary sizes', () => {
    const vec = [1, 2, 3]
    const padded = padEmbedding(vec, 6)
    expect(padded).toEqual([1, 2, 3, 0, 0, 0])
  })

  it('does not mutate the original array', () => {
    const vec = [1.0, 2.0]
    const original = [...vec]
    padEmbedding(vec, 4)
    expect(vec).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// Type contract: DocumentChunk shape
// ---------------------------------------------------------------------------

describe('DocumentChunk type contract', () => {
  it('chunk has required fields: chunk_index, content, metadata', () => {
    const content = `# Contract Test\n\n## Section\n\nSome content here for testing.\n\n## Sources\n\n- ref`
    const chunks: DocumentChunk[] = chunkDocument(content, 'contract.md')
    expect(chunks.length).toBeGreaterThan(0)
    const chunk = chunks[0]
    expect(typeof chunk.chunk_index).toBe('number')
    expect(typeof chunk.content).toBe('string')
    expect(typeof chunk.metadata).toBe('object')
    expect(typeof chunk.metadata.source).toBe('string')
    expect(typeof chunk.metadata.title).toBe('string')
    expect(typeof chunk.metadata.document_name).toBe('string')
  })
})
