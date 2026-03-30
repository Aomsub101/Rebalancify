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
