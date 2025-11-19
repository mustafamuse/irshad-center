'use server'

import React from 'react'

import { render } from '@react-email/components'

import { sendEmail, EMAIL_CONFIG } from '@/lib/email/email-service'

import { formatPDFData } from '../_lib/format-data'
import { generateScholarshipPDF } from '../_lib/generate-pdf'
import {
  scholarshipApplicationSchema,
  type ScholarshipApplicationData,
} from '../_schemas'
import { ScholarshipApplicationEmail } from '../_templates/email'

export interface SubmitScholarshipResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * Submit scholarship application
 * Server Action that validates, generates PDF, and sends email
 */
export async function submitScholarshipApplication(
  formData: ScholarshipApplicationData
): Promise<SubmitScholarshipResult> {
  try {
    // 1. Validate data server-side (never trust client)
    const validatedData = scholarshipApplicationSchema.parse(formData)

    // 2. Format data for PDF
    const pdfData = formatPDFData(validatedData)

    // 3. Generate PDF server-side
    const pdfBuffer = await generateScholarshipPDF(pdfData)

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
          filename: `scholarship-application-${validatedData.studentName.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ],
      replyTo: validatedData.email,
    })

    if (!emailResult.success) {
      return {
        success: false,
        error:
          'Failed to send application email. Please try again or contact support.',
      }
    }

    // 6. Send confirmation email to student (optional but recommended)
    await sendEmail({
      to: validatedData.email,
      subject: 'Scholarship Application Received',
      html: `
        <h2>Application Received</h2>
        <p>Dear ${validatedData.studentName},</p>
        <p>Thank you for submitting your scholarship application. We have received your application and will review it shortly.</p>
        <p>You will be notified of the decision via email or in person.</p>
        <p>Best regards,<br/>Mahad Office</p>
      `,
    })

    return {
      success: true,
      message: 'Your application has been submitted successfully',
    }
  } catch (error) {
    console.error('Scholarship submission error:', error)

    // Handle validation errors specifically
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        success: false,
        error: 'Please check all required fields and try again.',
      }
    }

    return {
      success: false,
      error:
        'An error occurred while submitting your application. Please try again.',
    }
  }
}
