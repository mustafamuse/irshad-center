import type { Student } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { Stripe } from 'stripe'

import { prisma } from '@/lib/db'
import {
  webhookStudentNameSchema,
  webhookPhoneSchema,
  webhookEmailSchema,
  validateWebhookData,
} from '@/lib/validations/webhook'

/**
 * Result of attempting to match a student from a Stripe checkout session
 */
export interface StudentMatchResult {
  /** The matched student, or null if no unique match found */
  student: Student | null
  /** How the student was matched (name, phone, or email) */
  matchMethod: 'name' | 'phone' | 'email' | null
  /** Validated email address from the session (may be useful for updating student) */
  validatedEmail: string | null
}

/**
 * Service for matching Stripe checkout sessions to existing students.
 * Attempts multiple matching strategies in order of preference:
 * 1. Student name from custom field
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
    session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // Try matching strategies in order of preference

    // 1. Try by name from custom field (most reliable)
    const nameResult = await this.findByName(session)
    if (nameResult.student) {
      return nameResult
    }

    // 2. Try by phone from custom field
    const phoneResult = await this.findByPhone(session)
    if (phoneResult.student) {
      return phoneResult
    }

    // 3. Try by payer email (least reliable but includes validated email)
    return this.findByEmail(session)
  }

  /**
   * Attempts to find a student by name from the custom field.
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByName(
    session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    const nameField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const rawName = nameField?.text?.value

    if (!rawName) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const validatedName = validateWebhookData(
      rawName,
      webhookStudentNameSchema,
      'student name'
    )

    if (!validatedName) {
      return { student: null, matchMethod: null, validatedEmail: null }
    }

    const students = await prisma.student.findMany({
      where: {
        name: { equals: validatedName, mode: 'insensitive' },
        stripeSubscriptionId: null,
      },
    })

    if (students.length === 1) {
      console.log(
        `[WEBHOOK] Found unique student by name: ${validatedName}. Student ID: ${students[0].id}`
      )
      return {
        student: students[0],
        matchMethod: 'name',
        validatedEmail: null,
      }
    }

    // No match or ambiguous (multiple students with same name)
    if (students.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple students found with name: ${validatedName}. Cannot determine unique match.`
      )
    }

    return { student: null, matchMethod: null, validatedEmail: null }
  }

  /**
   * Attempts to find a student by phone number from the custom field.
   * Uses normalized phone matching (digits only).
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByPhone(
    session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
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
  }

  /**
   * Attempts to find a student by the payer's email address.
   * Also returns the validated email for potential student record updates.
   * Only returns a match if exactly one unlinked student is found.
   */
  private async findByEmail(
    session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
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
    const nameField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )

    console.warn(
      `[WEBHOOK] Could not find a unique, unlinked student for subscription ${subscriptionId}. ` +
        `Attempted lookup with name: "${nameField?.text?.value || 'N/A'}", ` +
        `phone: "${phoneField?.numeric?.value || 'N/A'}", ` +
        `and payer email: "${session.customer_details?.email || 'N/A'}". Manual review required.`
    )
  }
}

// Export singleton instance for consistent usage across the application
export const studentMatcher = new StudentMatcher()
