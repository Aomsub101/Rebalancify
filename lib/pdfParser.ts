// DOMMatrix polyfill — required for pdf-parse in Node.js (server-side bundling)
// @thednp/dommatrix is a pure JS DOMMatrix implementation — no native binaries needed
import DOMMatrix from '@thednp/dommatrix'
// @ts-ignore - DOMMatrix is needed by pdf-parse browser build at runtime
globalThis.DOMMatrix = DOMMatrix

// pdf-parse is listed in serverExternalPackages — will be required at runtime
import { PDFParse } from 'pdf-parse'

/**
 * Extracts text from a PDF Buffer using pdf-parse.
 * @param buffer The PDF file buffer
 * @returns The extracted text
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text
}
