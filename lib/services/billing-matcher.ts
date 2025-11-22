/**
 * Billing Matcher Service
 *
 * Matches Stripe checkout sessions to billing accounts and program profiles
 * in the new unified identity model.
 */

import { StripeAccountType } from '@prisma/client'
import type { Stripe } from 'stripe'

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { normalizePhone } from '@/lib/types/person'
import {
  webhookPhoneSchema,
  webhookEmailSchema,
  validateWebhookData,
} from '@/lib/validations/webhook'

/**
 * Result of attempting to match a billing account/program profile from a Stripe checkout session
 */
export interface BillingMatchResult {
  /** The matched billing account, or null if no match found */
  billingAccount: Awaited<
    ReturnType<typeof prisma.billingAccount.findUnique>
  > | null
  /** The matched program profile, or null if no match found */
  programProfile: Awaited<
    ReturnType<typeof prisma.programProfile.findUnique>
  > | null
  /** How the match was made (phone, email, or guardian) */
  matchMethod: 'phone' | 'email' | 'guardian' | null
  /** Validated email address from the session */
  validatedEmail: string | null
  /** Account type (MAHAD, DUGSI, etc.) */
  accountType: StripeAccountType | null
}

/**
 * Service for matching Stripe checkout sessions to billing accounts and program profiles.
 * Attempts multiple matching strategies:
 * 1. Student email from custom field → Person → ProgramProfile
 * 2. Student phone from custom field → Person → ProgramProfile
 * 3. Payer email → Person → BillingAccount (for guardian payers)
 */
export class BillingMatcher {
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
  ): Promise<BillingMatchResult> {
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
  ): Promise<BillingMatchResult> {
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

    // Find program profile for this person and account type
    const program = accountType === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    const profile = await prisma.programProfile.findFirst({
      where: {
        personId: person.id,
        program,
        // Only match profiles without active subscriptions
        assignments: {
          none: {
            isActive: true,
            subscription: {
              status: { in: ['active', 'trialing'] },
            },
          },
        },
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

    if (profile) {
      // Find or create billing account
      const billingAccount = await prisma.billingAccount.findFirst({
        where: {
          personId: person.id,
          accountType,
        },
      })

      console.log(
        `[BILLING_MATCHER] Found program profile by custom field email: ${validatedEmail}. Profile ID: ${profile.id}`
      )

      return {
        billingAccount,
        programProfile: profile,
        matchMethod: 'email',
        validatedEmail,
        accountType,
      }
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
  ): Promise<BillingMatchResult> {
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

    // Find program profile
    const program = accountType === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    const profile = await prisma.programProfile.findFirst({
      where: {
        personId: person.id,
        program,
        assignments: {
          none: {
            isActive: true,
            subscription: {
              status: { in: ['active', 'trialing'] },
            },
          },
        },
      },
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    })

    if (profile) {
      const billingAccount = await prisma.billingAccount.findFirst({
        where: {
          personId: person.id,
          accountType,
        },
      })

      console.log(
        `[BILLING_MATCHER] Found program profile by phone: ${validatedPhone}. Profile ID: ${profile.id}`
      )

      return {
        billingAccount,
        programProfile: profile,
        matchMethod: 'phone',
        validatedEmail: null,
        accountType,
      }
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
  ): Promise<BillingMatchResult> {
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
      console.log(
        `[BILLING_MATCHER] Found billing account by payer email: ${validatedEmail}. Account ID: ${billingAccount.id}`
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
    const profile = await prisma.programProfile.findFirst({
      where: {
        personId: person.id,
        program,
        assignments: {
          none: {
            isActive: true,
            subscription: {
              status: { in: ['active', 'trialing'] },
            },
          },
        },
      },
    })

    if (profile) {
      return {
        billingAccount: null,
        programProfile: profile,
        matchMethod: 'email',
        validatedEmail,
        accountType,
      }
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

    console.warn(
      `[BILLING_MATCHER] Could not find billing account or program profile for subscription ${subscriptionId} (${accountType}). ` +
        `Attempted lookup with custom field email: "${emailField?.text?.value || 'N/A'}", ` +
        `phone: "${phoneField?.numeric?.value || 'N/A'}", ` +
        `and payer email: "${session.customer_details?.email || 'N/A'}". Manual review required.`
    )
  }
}

// Export singleton instance
export const billingMatcher = new BillingMatcher()
