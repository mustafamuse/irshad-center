'use server'

import React from 'react'

import { render } from '@react-email/components'

import {
  sendEmail,
  sendConfirmationEmail,
  EMAIL_CONFIG,
} from '@/lib/email/email-service'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { sanitizeFilename } from '@/lib/utils/sanitize'

import { formatPDFData } from '../_lib/format-data'
import { generateScholarshipPDF } from '../_lib/generate-pdf'
import { scholarshipApplicationSchema } from '../_schemas'
import { ScholarshipApplicationEmail } from '../_templates/email/scholarship'

export interface SubmitScholarshipResult {
  success: boolean
  error?: string
  message?: string
  code?: string
  field?: string
}

/**
 * Submit scholarship application
 * Server Action that validates, generates PDF, and sends email
 *
 * @param formData - Unvalidated form data from client (validated server-side)
 * @returns Promise with success/error result
 * @throws Never throws - always returns result object for safe error handling
 *
 * @example
 * const result = await submitScholarshipApplication(formData)
 * if (!result.success) {
 *   console.error(result.error)
 * }
 */
export async function submitScholarshipApplication(
  formData: unknown
): Promise<SubmitScholarshipResult> {
  try {
    // 1. Validate data server-side (never trust client - accept unknown, validate runtime)
    const validation = scholarshipApplicationSchema.safeParse(formData)

    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid form data. Please check all required fields.',
      }
    }

    const validatedData = validation.data

    // 2. Format data for PDF
    const pdfData = formatPDFData(validatedData)

    // 3. Generate PDF server-side with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateScholarshipPDF(pdfData)
    } catch (error) {
      console.error('PDF generation failed:', error)
      throw new ActionError(
        'Failed to generate application PDF. Please try again.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    // 4. Generate email HTML
    const emailHtml = await render(
      <ScholarshipApplicationEmail
        studentName={validatedData.studentName}
        studentEmail={validatedData.email}
        className={validatedData.className}
        phone={validatedData.phone}
      />
    )

    // 5. Send email to admin with PDF attachment
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

    // 6. Send confirmation email to student
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

    return {
      success: true,
      message: 'Your application has been submitted successfully',
    }
  } catch (error) {
    console.error('Scholarship submission error:', error)

    // Return ActionError in consistent format
    if (error instanceof ActionError) {
      return error.toJSON()
    }

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        success: false,
        error: 'Please check all required fields and try again.',
        code: ERROR_CODES.VALIDATION_ERROR,
      }
    }

    // Generic server error
    return {
      success: false,
      error:
        'An error occurred while submitting your application. Please try again.',
      code: ERROR_CODES.SERVER_ERROR,
    }
  }
}
