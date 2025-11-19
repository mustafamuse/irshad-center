import { resend, EMAIL_CONFIG as CONFIG } from './resend-client'
import { escapeHtml } from '../utils/html-escape'

// Re-export for convenience
export { EMAIL_CONFIG } from './resend-client'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  react?: React.ReactElement
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface EmailResult {
  success: boolean
  error?: string
  id?: string
}

/**
 * Send an email using Resend
 * Core email function reusable across the entire application
 *
 * @param options - Email configuration (to, subject, html/react, attachments, etc.)
 * @returns Promise with success status and email ID if successful
 * @throws Never throws - returns error in result object
 *
 * @example
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * })
 * if (result.success) console.log('Sent:', result.id)
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      react: options.react,
      text: options.text,
      attachments: options.attachments,
      replyTo: options.replyTo || CONFIG.replyTo,
      cc: options.cc,
      bcc: options.bcc,
    })

    if (error) {
      console.error('Email sending failed:', error)
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }

    return {
      success: true,
      id: data?.id,
    }
  } catch (error) {
    console.error('Email service error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email to admin with PDF attachment
 * Reusable for scholarship applications, student registrations, etc.
 */
export async function sendAdminEmailWithPDF(options: {
  subject: string
  studentName: string
  studentEmail: string
  pdfBuffer: Buffer
  pdfFilename: string
  additionalInfo?: string
}): Promise<EmailResult> {
  const html = `
    <h2>${escapeHtml(options.subject)}</h2>
    <p><strong>Student Name:</strong> ${escapeHtml(options.studentName)}</p>
    <p><strong>Student Email:</strong> ${escapeHtml(options.studentEmail)}</p>
    ${options.additionalInfo ? `<p>${escapeHtml(options.additionalInfo)}</p>` : ''}
    <p>Please see the attached PDF for complete details.</p>
  `

  return sendEmail({
    to: CONFIG.adminEmail,
    subject: options.subject,
    html,
    attachments: [
      {
        filename: options.pdfFilename,
        content: options.pdfBuffer,
      },
    ],
    replyTo: options.studentEmail,
  })
}

/**
 * Send confirmation email to student
 * Reusable for various confirmation scenarios
 */
export async function sendConfirmationEmail(options: {
  to: string
  studentName: string
  subject: string
  message: string
  nextSteps?: string[]
}): Promise<EmailResult> {
  const html = `
    <h2>Hello ${escapeHtml(options.studentName)},</h2>
    <p>${escapeHtml(options.message)}</p>
    ${
      options.nextSteps
        ? `
      <h3>Next Steps:</h3>
      <ul>
        ${options.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ul>
    `
        : ''
    }
    <p>If you have any questions, please contact us at ${escapeHtml(CONFIG.adminEmail)}</p>
    <p>Best regards,<br/>Irshad Center</p>
  `

  return sendEmail({
    to: options.to,
    subject: options.subject,
    html,
  })
}
