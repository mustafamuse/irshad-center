'use server'

import React from 'react'

import { render } from '@react-email/components'

import {
  sendEmail,
  sendConfirmationEmail,
  EMAIL_CONFIG,
} from '@/lib/email/email-service'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger, logError, logWarning } from '@/lib/logger'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { sanitizeFilename } from '@/lib/utils/sanitize'

import { formatPDFData } from '../_lib/format-data'
import { generateScholarshipPDF } from '../_lib/generate-pdf'
import { scholarshipApplicationSchema } from '../_schemas'
import { ScholarshipApplicationEmail } from '../_templates/email/scholarship'

const logger = createActionLogger('scholarship-application')

const _submitScholarshipApplication = rateLimitedActionClient
  .metadata({ actionName: 'submitScholarshipApplication', maxAttempts: 5 })
  .schema(scholarshipApplicationSchema)
  .action(async ({ parsedInput: validatedData }) => {
    const pdfData = formatPDFData(validatedData)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateScholarshipPDF(pdfData)
    } catch (error) {
      await logError(logger, error, 'PDF generation failed', {
        studentName: validatedData.studentName,
      })
      throw new ActionError(
        'Failed to generate application PDF. Please try again.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    const emailHtml = await render(
      <ScholarshipApplicationEmail
        studentName={validatedData.studentName}
        studentEmail={validatedData.email}
        className={validatedData.className}
        phone={validatedData.phone}
      />
    )

    const emailResult = await sendEmail({
      to: EMAIL_CONFIG.adminEmail,
      subject: `Scholarship Application - ${validatedData.studentName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `scholarship-application-${sanitizeFilename(validatedData.studentName)}.pdf`,
          content: pdfBuffer,
        },
      ],
      replyTo: validatedData.email,
    })

    if (!emailResult.success) {
      throw new ActionError(
        'Failed to send application email. Please try again or contact support.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    try {
      await sendConfirmationEmail({
        to: validatedData.email,
        studentName: validatedData.studentName,
        subject: 'Scholarship Application Received',
        message:
          'Thank you for submitting your scholarship application. We have received your application and will review it shortly.',
        nextSteps: [
          'Application review by the Mahad Office',
          'Evaluation of financial need and circumstances',
          'Decision notification via email or in person',
        ],
      })
    } catch (error) {
      await logWarning(logger, 'Failed to send confirmation email to student', {
        error: error instanceof Error ? error.message : 'Unknown error',
        studentEmail: validatedData.email,
      })
    }

    return { message: 'Your application has been submitted successfully' }
  })

export async function submitScholarshipApplication(
  ...args: Parameters<typeof _submitScholarshipApplication>
) {
  return _submitScholarshipApplication(...args)
}
