import ReactPDF from '@react-pdf/renderer'

import {
  ScholarshipPDFDocument,
  type ScholarshipPDFData,
} from '../_templates/pdf/document'

/**
 * Generate scholarship application PDF server-side
 * Converts React PDF document to binary buffer for email attachments
 *
 * @param data - Formatted scholarship application data
 * @returns Promise resolving to PDF as Buffer
 * @throws Rejects promise if PDF generation fails
 *
 * @example
 * const pdfBuffer = await generateScholarshipPDF(formattedData)
 * // Use buffer in email attachment or save to file
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
