/**
 * Unified Matcher Service
 *
 * Consolidated service for matching Stripe checkout sessions to billing accounts
 * and program profiles across all programs (Mahad, Dugsi, etc.).
 *
 * Combines functionality from the legacy billing-matcher and profile-matcher services.
 *
 * Matching Strategies (in order of preference):
 * 1. Student email from custom field → Person → ProgramProfile
 * 2. Student phone from custom field → Person → ProgramProfile
 * 3. Payer email → Person → BillingAccount (for guardian payers)
 */

import { StripeAccountType } from '@prisma/client'
import type { Stripe } from 'stripe'
import * as Sentry from '@sentry/nextjs'

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { createServiceLogger } from '@/lib/logger'
import { normalizePhone } from '@/lib/utils/contact-normalization'
import {
  webhookPhoneSchema,
  webhookEmailSchema,
  validateWebhookData,
} from '@/lib/validations/webhook'

const logger = createServiceLogger('unified-matcher')

/**
 * Result of attempting to match from a Stripe checkout session
 */
export interface UnifiedMatchResult {
  /** The matched billing account, or null if no match found */
  billingAccount: Awaited<
    ReturnType<typeof prisma.billingAccount.findFirst>
  > | null
  /** The matched program profile, or null if no match found */
  programProfile: Awaited<
    ReturnType<typeof prisma.programProfile.findFirst>
  > | null
  /** How the match was made (phone, email, or guardian) */
  matchMethod: 'phone' | 'email' | 'guardian' | null
  /** Validated email address from the session */
  validatedEmail: string | null
  /** Account type (MAHAD, DUGSI, etc.) */
  accountType: StripeAccountType
}

/**
 * Unified service for matching Stripe checkout sessions to billing accounts
 * and program profiles.
 *
 * Supports both Mahad and Dugsi programs with their different matching requirements:
 * - Mahad: Direct student matching via email/phone
 * - Dugsi: Guardian-based matching for family subscriptions
 */
export class UnifiedMatcher {
  /**
   * Attempts to find a billing account and program profile from a Stripe checkout session.
   *
   * @param session - The Stripe checkout session to match
   * @param accountType - The Stripe account type (MAHAD, DUGSI, etc.)
   * @returns Result containing matched billing account and program profile
   */
  async findByCheckoutSession(
    session: Stripe.Checkout.Session,
    accountType: StripeAccountType
  ): Promise<UnifiedMatchResult> {
    // Try matching strategies in order of preference

    // 1. Try by email from custom field (most reliable)
    const customEmailResult = await this.findByCustomEmail(session, accountType)
    if (customEmailResult.programProfile) {
      return customEmailResult
    }

    // 2. Try by phone from custom field
    const phoneResult = await this.findByPhone(session, accountType)
    if (phoneResult.programProfile) {
      return phoneResult
    }

    // 3. Try by payer email (might be guardian)
    return this.findByPayerEmail(session, accountType)
  }

  /**
   * Attempts to find a program profile by email from the custom field.
   */
  private async findByCustomEmail(
    session: Stripe.Checkout.Session,
    accountType: StripeAccountType
  ): Promise<UnifiedMatchResult> {
    const emailField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const rawEmail = emailField?.text?.value

    if (!rawEmail) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'student email (custom field)'
    )

    if (!validatedEmail) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    // Find person by email
    const person = await Sentry.startSpan(
      {
        name: 'matcher.find_person_by_email',
        op: 'db.query',
        attributes: {
          email: validatedEmail,
        },
      },
      async () => await findPersonByContact(validatedEmail, null)
    )
    if (!person) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail,
        accountType,
      }
    }

    // Find program profile for this person and account type
    const program = accountType === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    const profiles = await Sentry.startSpan(
      {
        name: 'matcher.find_program_profiles',
        op: 'db.query',
        attributes: {
          person_id: person.id,
          program,
        },
      },
      async () =>
        await prisma.programProfile.findMany({
          where: {
            personId: person.id,
            program,
          },
          include: {
            person: {
              include: {
                contactPoints: true,
              },
            },
            assignments: {
              where: { isActive: true },
              include: {
                subscription: true,
              },
            },
          },
        })
    )

    // Filter to only unlinked profiles (no active subscriptions) - in memory
    const unlinkedProfiles = profiles.filter(
      (profile) =>
        !profile.assignments.some(
          (a) =>
            a.subscription.status === 'active' ||
            a.subscription.status === 'trialing'
        )
    )

    if (unlinkedProfiles.length === 1) {
      const profile = unlinkedProfiles[0]

      // Find or get billing account info
      const billingAccount = await prisma.billingAccount.findFirst({
        where: {
          personId: person.id,
          accountType,
        },
      })

      logger.info(
        {
          email: validatedEmail,
          profileId: profile.id,
        },
        'Found profile by custom field email'
      )

      return {
        billingAccount,
        programProfile: profile,
        matchMethod: 'email',
        validatedEmail,
        accountType,
      }
    }

    if (unlinkedProfiles.length > 1) {
      logger.warn(
        { email: validatedEmail, count: unlinkedProfiles.length },
        'Multiple unlinked profiles found with email, cannot determine unique match'
      )
    }

    return {
      billingAccount: null,
      programProfile: null,
      matchMethod: null,
      validatedEmail,
      accountType,
    }
  }

  /**
   * Attempts to find a program profile by phone from the custom field.
   */
  private async findByPhone(
    session: Stripe.Checkout.Session,
    accountType: StripeAccountType
  ): Promise<UnifiedMatchResult> {
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )
    const rawPhone = phoneField?.numeric?.value

    if (!rawPhone) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    const normalizedPhone = normalizePhone(String(rawPhone))
    const validatedPhone = validateWebhookData(
      normalizedPhone,
      webhookPhoneSchema,
      'phone number'
    )

    if (!validatedPhone) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    // Find person by phone
    const person = await findPersonByContact(null, validatedPhone)
    if (!person) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    // Find program profile with assignments included to avoid N+1
    const program = accountType === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    const profiles = await prisma.programProfile.findMany({
      where: {
        personId: person.id,
        program,
      },
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
        assignments: {
          where: { isActive: true },
          include: {
            subscription: true,
          },
        },
      },
    })

    // Filter to only unlinked profiles (no active subscriptions) - now in memory
    const unlinkedProfiles = profiles.filter(
      (profile) =>
        !profile.assignments.some(
          (a) =>
            a.subscription.status === 'active' ||
            a.subscription.status === 'trialing'
        )
    )

    if (unlinkedProfiles.length === 1) {
      const profile = unlinkedProfiles[0]

      const billingAccount = await prisma.billingAccount.findFirst({
        where: {
          personId: person.id,
          accountType,
        },
      })

      logger.info(
        {
          phone: validatedPhone,
          profileId: profile.id,
        },
        'Found profile by phone'
      )

      return {
        billingAccount,
        programProfile: profile,
        matchMethod: 'phone',
        validatedEmail: null,
        accountType,
      }
    }

    if (unlinkedProfiles.length > 1) {
      logger.warn(
        { phone: validatedPhone, count: unlinkedProfiles.length },
        'Multiple unlinked profiles found with phone, cannot determine unique match'
      )
    }

    return {
      billingAccount: null,
      programProfile: null,
      matchMethod: null,
      validatedEmail: null,
      accountType,
    }
  }

  /**
   * Attempts to find a billing account by payer email (might be guardian).
   */
  private async findByPayerEmail(
    session: Stripe.Checkout.Session,
    accountType: StripeAccountType
  ): Promise<UnifiedMatchResult> {
    const rawEmail = session.customer_details?.email

    if (!rawEmail) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'payer email'
    )

    if (!validatedEmail) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail: null,
        accountType,
      }
    }

    // Find person by email (could be student or guardian)
    const person = await findPersonByContact(validatedEmail, null)
    if (!person) {
      return {
        billingAccount: null,
        programProfile: null,
        matchMethod: null,
        validatedEmail,
        accountType,
      }
    }

    // Try to find billing account first (guardian payer)
    const billingAccount = await prisma.billingAccount.findFirst({
      where: {
        personId: person.id,
        accountType,
      },
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    })

    // If billing account exists, this might be a guardian paying for dependents
    if (billingAccount) {
      logger.info(
        {
          email: validatedEmail,
          billingAccountId: billingAccount.id,
        },
        'Found billing account by payer email'
      )

      return {
        billingAccount,
        programProfile: null, // Guardian account, no specific profile
        matchMethod: 'guardian',
        validatedEmail,
        accountType,
      }
    }

    // Otherwise, try to find program profile (self-pay student)
    const program = accountType === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    const profiles = await prisma.programProfile.findMany({
      where: {
        personId: person.id,
        program,
      },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            subscription: true,
          },
        },
      },
    })

    // Filter to only unlinked profiles - now in memory
    const unlinkedProfiles = profiles.filter(
      (profile) =>
        !profile.assignments.some(
          (a) =>
            a.subscription.status === 'active' ||
            a.subscription.status === 'trialing'
        )
    )

    if (unlinkedProfiles.length === 1) {
      const profile = unlinkedProfiles[0]

      logger.info(
        {
          email: validatedEmail,
          profileId: profile.id,
        },
        'Found profile by payer email'
      )

      return {
        billingAccount: null,
        programProfile: profile,
        matchMethod: 'email',
        validatedEmail,
        accountType,
      }
    }

    if (unlinkedProfiles.length > 1) {
      logger.warn(
        { email: validatedEmail, count: unlinkedProfiles.length },
        'Multiple unlinked profiles found with payer email, cannot determine unique match'
      )
    }

    return {
      billingAccount: null,
      programProfile: null,
      matchMethod: null,
      validatedEmail,
      accountType,
    }
  }

  /**
   * Logs detailed information when no match can be found.
   */
  logNoMatchFound(
    session: Stripe.Checkout.Session,
    subscriptionId: string,
    accountType: StripeAccountType
  ): void {
    const emailField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )

    logger.warn(
      {
        subscriptionId,
        accountType,
        customFieldEmail: emailField?.text?.value || null,
        customFieldPhone: phoneField?.numeric?.value || null,
        payerEmail: session.customer_details?.email || null,
      },
      'Could not find billing account or program profile, manual review required'
    )
  }
}

// Export singleton instance
export const unifiedMatcher = new UnifiedMatcher()
