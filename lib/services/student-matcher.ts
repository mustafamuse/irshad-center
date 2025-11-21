// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

import { _Prisma } from '@prisma/client'
import type { Stripe } from 'stripe'

import { _prisma } from '@/lib/db'
import {
  _webhookPhoneSchema,
  _webhookEmailSchema,
  _validateWebhookData,
} from '@/lib/validations/webhook'

/**
 * Result of attempting to match a student from a Stripe checkout session
 */
export interface StudentMatchResult {
  /** The matched student, or null if no unique match found */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any | null
  /** How the student was matched (phone or email) */
  matchMethod: 'phone' | 'email' | null
  /** Validated email address from the session (may be useful for updating student) */
  validatedEmail: string | null
}

/**
 * Service for matching Stripe checkout sessions to existing students.
 * Attempts multiple matching strategies in order of preference:
 * 1. Student email from custom field
 * 2. Student phone from custom field
 * 3. Payer email from customer details
 *
 * Only matches students that don't already have a Stripe subscription.
 */
export class StudentMatcher {
  /**
   * Attempts to find a unique, unlinked student from a Stripe checkout session.
   * Tries multiple matching strategies in order of preference.
   *
   * @param session - The Stripe checkout session to match
   * @returns Result containing the matched student (if any) and metadata
   */
  async findByCheckoutSession(
    _session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
    return {
      student: null,
      matchMethod: null,
      validatedEmail: null,
    } // Temporary: return no match until migration complete

    /* Original implementation commented out - needs migration:
    // Try matching strategies in order of preference

    // 1. Try by email from custom field (most reliable - unique identifier)
    const customEmailResult = await this.findByCustomEmail(session)
    if (customEmailResult.student) {
      return customEmailResult
    }

    // 2. Try by phone from custom field
    const phoneResult = await this.findByPhone(session)
    if (phoneResult.student) {
      return phoneResult
    }

    // 3. Try by payer email (fallback - might be parent's email)
    return this.findByEmail(session)
    */
  }

  /**
   * Attempts to find a student by email from the custom field.
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByCustomEmail(
    _session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
    return { student: null, matchMethod: null, validatedEmail: null }

    /* Original implementation commented out - needs migration:
    const emailField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const rawEmail = emailField?.text?.value

    if (!rawEmail) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'student email (custom field)'
    )

    if (!validatedEmail) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const students = await prisma.student.findMany({
      where: {
        email: { equals: validatedEmail, mode: 'insensitive' },
        stripeSubscriptionId: null,
      },
    })

    if (students.length === 1) {
      console.log(
        `[WEBHOOK] Found unique student by custom field email: ${validatedEmail}. Student ID: ${students[0].id}`
      )
      return {
        student: students[0],
        matchMethod: 'email',
        validatedEmail,
      }
    }

    // No match or ambiguous (multiple students with same email)
    if (students.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple students found with email: ${validatedEmail}. Cannot determine unique match.`
      )
    }
    */
  }

  /**
   * Attempts to find a student by phone number from the custom field.
   * Uses normalized phone matching (digits only).
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByPhone(
    _session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
    return { student: null, matchMethod: null, validatedEmail: null }

    /* Original implementation commented out - needs migration:
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )
    const rawPhone = phoneField?.numeric?.value

    if (!rawPhone) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    // Normalize and validate
    const normalizedPhone = rawPhone.replace(/\D/g, '')
    const validatedPhone = validateWebhookData(
      normalizedPhone,
      webhookPhoneSchema,
      'phone number'
    )

    if (!validatedPhone) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    // Use raw SQL for normalized phone matching
    const students = await prisma.$queryRaw<Student[]>(Prisma.sql`
      SELECT * FROM "Student"
      WHERE REGEXP_REPLACE("phone", '[^0-9]', '', 'g') = ${validatedPhone}
      AND "stripeSubscriptionId" IS NULL
    `)

    if (students.length === 1) {
      console.log(
        `[WEBHOOK] Found unique student by normalized phone: ${validatedPhone}. Student ID: ${students[0].id}`
      )
      return {
        student: students[0],
        matchMethod: 'phone',
        validatedEmail: null,
      }
    }

    // No match or ambiguous (multiple students with same phone)
    if (students.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple students found with phone: ${validatedPhone}. Cannot determine unique match.`
      )
    }

    return { student: null, matchMethod: null, validatedEmail: null }
    */
  }

  /**
   * Attempts to find a student by the payer's email address.
   * Also returns the validated email for potential student record updates.
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByEmail(
    _session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
    return { student: null, matchMethod: null, validatedEmail: null }

    /* Original implementation commented out - needs migration:
    const rawEmail = session.customer_details?.email

    if (!rawEmail) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'payer email'
    )

    if (!validatedEmail) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const students = await prisma.student.findMany({
      where: {
        email: { equals: validatedEmail, mode: 'insensitive' },
        stripeSubscriptionId: null,
      },
    })

    if (students.length === 1) {
      console.log(
        `[WEBHOOK] Found unique student by payer email: ${validatedEmail}. Student ID: ${students[0].id}`
      )
      return {
        student: students[0],
        matchMethod: 'email',
        validatedEmail, // Return for potential update
      }
    }

    // No match or ambiguous (multiple students with same email)
    if (students.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple students found with email: ${validatedEmail}. Cannot determine unique match.`
      )
    }

    // No student found, but still return validated email
    // This can be used to update a student found by other means
    return {
      student: null,
      matchMethod: null,
      validatedEmail,
    }
    */
  }

  /**
   * Logs detailed information when no unique student can be found.
   * Useful for manual review and debugging.
   *
   * @param session - The checkout session that couldn't be matched
   * @param subscriptionId - The subscription ID for reference
   */
  logNoMatchFound(
    session: Stripe.Checkout.Session,
    subscriptionId: string
  ): void {
    const emailField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )

    console.warn(
      `[WEBHOOK] Could not find a unique, unlinked student for subscription ${subscriptionId}. ` +
        `Attempted lookup with custom field email: "${emailField?.text?.value || 'N/A'}", ` +
        `phone: "${phoneField?.numeric?.value || 'N/A'}", ` +
        `and payer email: "${session.customer_details?.email || 'N/A'}". Manual review required.`
    )
  }
}

// Export singleton instance for consistent usage across the application
export const studentMatcher = new StudentMatcher()
