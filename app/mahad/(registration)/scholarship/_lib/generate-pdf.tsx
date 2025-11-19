import ReactPDF from '@react-pdf/renderer'

import {
  ScholarshipPDFDocument,
  type ScholarshipPDFData,
} from '../_templates/document'

/**
 * Generate scholarship application PDF server-side
 * Returns a Buffer that can be attached to emails or saved
 */
export async function generateScholarshipPDF(
  data: ScholarshipPDFData
): Promise<Buffer> {
  const pdfStream = await ReactPDF.renderToStream(
    <ScholarshipPDFDocument data={data} />
  )

  // Convert stream to buffer
  const chunks: Uint8Array[] = []

  return new Promise((resolve, reject) => {
    pdfStream.on('data', (chunk) => chunks.push(chunk))
    pdfStream.on('end', () => resolve(Buffer.concat(chunks)))
    pdfStream.on('error', reject)
  })
}
