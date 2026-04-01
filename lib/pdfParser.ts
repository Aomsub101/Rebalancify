/**
 * PDF parsing utilities for the Knowledge Hub.
 *
 * pdfjs-dist (used internally by pdf-parse) requires two runtime polyfills
 * when running on Node.js versions older than 22:
 *   1. globalThis.DOMMatrix  — canvas/geometry operations
 *   2. process.getBuiltinModule — for fs/module/url access (Node 22+ only)
 *
 * Both polyfills are applied lazily inside parsePdf() on first call.
 * Dynamic import() of pdf-parse is used so webpack does NOT bundle
 * pdfjs-dist at build time — pdf-parse stays as an external require()
 * at runtime (it is listed in serverExternalPackages in next.config.ts).
 */

/**
 * Sets up polyfills needed by pdfjs-dist (inside pdf-parse) for Node.js <22.
 * Called lazily at runtime — never evaluated during webpack build analysis.
 */
function setupPolyfills() {
  // DOMMatrix polyfill — required by pdfjs-dist for canvas operations
  // @thednp/dommatrix is a pure JS DOMMatrix implementation — no native binaries needed
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: DOMMatrix } = require('@thednp/dommatrix')
    // @ts-ignore - DOMMatrix is needed by pdfjs-dist at runtime
    globalThis.DOMMatrix = DOMMatrix
  }

  // pdfjs-dist 5.x uses process.getBuiltinModule (Node 22+ only).
  // On older Node versions (e.g., Railway's Node 20), provide a fallback
  // using module.createRequire so pdfjs-dist's Node.js code paths still work.
  if (typeof (process as any).getBuiltinModule === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRequire } = require('module')
    const _require = createRequire(__filename)
    ;(process as any).getBuiltinModule = (id: string) => _require(id)
  }
}

// Lazily initialized PDFParse class — imported at runtime, not during webpack build
let _PDFParse: typeof import('pdf-parse').PDFParse | null = null

async function getPdfParse() {
  if (!_PDFParse) {
    setupPolyfills()
    // Dynamic import ensures webpack does not eagerly bundle pdfjs-dist at build time.
    // pdf-parse is marked as serverExternal in next.config — it stays as require() at runtime.
    const mod = await import('pdf-parse')
    _PDFParse = mod.PDFParse
  }
  return _PDFParse
}

/**
 * Extracts text from a PDF Buffer using pdf-parse.
 * Polyfills (DOMMatrix, process.getBuiltinModule fallback) are applied on first call.
 * @param buffer The PDF file buffer
 * @returns The extracted text
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const PDFParse = await getPdfParse()
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text
}
