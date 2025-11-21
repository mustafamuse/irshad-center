/**
 * Profile Matcher Service
 *
 * Service for matching Stripe checkout sessions to existing ProgramProfiles.
 * Attempts multiple matching strategies in order of preference:
 * 1. Student email from custom field
 * 2. Student phone from custom field
 * 3. Payer email from customer details
 *
 * Only matches profiles that don't already have an active BillingAssignment.
 */

import type { ProgramProfile } from '@prisma/client'
import type { Stripe } from 'stripe'

import { getBillingAssignmentsByProfile } from '@/lib/db/queries/billing'
import {
  findPersonByContact,
  _searchProgramProfilesByNameOrContact,
} from '@/lib/db/queries/program-profile'
import {
  webhookPhoneSchema,
  webhookEmailSchema,
  validateWebhookData,
} from '@/lib/validations/webhook'

/**
 * Result of attempting to match a profile from a Stripe checkout session
 */
export interface ProfileMatchResult {
  /** The matched profile, or null if no unique match found */
  profile: ProgramProfile | null
  /** How the profile was matched (phone or email) */
  matchMethod: 'phone' | 'email' | null
  /** Validated email address from the session (may be useful for updating profile) */
  validatedEmail: string | null
}

/**
 * Service for matching Stripe checkout sessions to existing ProgramProfiles.
 */
export class ProfileMatcher {
  /**
   * Attempts to find a unique, unlinked profile from a Stripe checkout session.
   * Tries multiple matching strategies in order of preference.
   *
   * @param session - The Stripe checkout session to match
   * @param program - The program to match against (MAHAD_PROGRAM or DUGSI_PROGRAM)
   * @returns Result containing the matched profile (if any) and metadata
   */
  async findByCheckoutSession(
    session: Stripe.Checkout.Session,
    program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM' = 'MAHAD_PROGRAM'
  ): Promise<ProfileMatchResult> {
    // Try matching strategies in order of preference

    // 1. Try by email from custom field (most reliable - unique identifier)
    const customEmailResult = await this.findByCustomEmail(session, program)
    if (customEmailResult.profile) {
      return customEmailResult
    }

    // 2. Try by phone from custom field
    const phoneResult = await this.findByPhone(session, program)
    if (phoneResult.profile) {
      return phoneResult
    }

    // 3. Try by payer email (fallback - might be parent's email)
    return this.findByEmail(session, program)
  }

  /**
   * Attempts to find a profile by email from the custom field.
   * Only returns a match if exactly one unlinked profile is found.
   */
  private async findByCustomEmail(
    session: Stripe.Checkout.Session,
    program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'
  ): Promise<ProfileMatchResult> {
    const emailField = session.custom_fields?.find(
      (f) => f.key === 'studentsemailonethatyouusedtoregister'
    )
    const rawEmail = emailField?.text?.value

    if (!rawEmail) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'student email (custom field)'
    )

    if (!validatedEmail) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Find person by email
    const person = await findPersonByContact(validatedEmail, null)
    if (!person) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Get profiles for this person and program
    const profiles = person.programProfiles.filter((p) => p.program === program)

    // Filter out profiles that already have active billing assignments
    const unlinkedProfiles = []
    for (const profile of profiles) {
      const assignments = await getBillingAssignmentsByProfile(profile.id)
      if (assignments.length === 0) {
        unlinkedProfiles.push(profile)
      }
    }

    if (unlinkedProfiles.length === 1) {
      console.log(
        `[WEBHOOK] Found unique profile by custom field email: ${validatedEmail}. Profile ID: ${unlinkedProfiles[0].id}`
      )
      return {
        profile: unlinkedProfiles[0],
        matchMethod: 'email',
        validatedEmail,
      }
    }

    // No match or ambiguous (multiple profiles with same email)
    if (unlinkedProfiles.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple profiles found with email: ${validatedEmail}. Cannot determine unique match.`
      )
    }

    return { profile: null, matchMethod: null, validatedEmail: null }
  }

  /**
   * Attempts to find a profile by phone number from the custom field.
   * Uses normalized phone matching (digits only).
   * Only returns a match if exactly one unlinked profile is found.
   */
  private async findByPhone(
    session: Stripe.Checkout.Session,
    program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'
  ): Promise<ProfileMatchResult> {
    const phoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )
    const rawPhone = phoneField?.numeric?.value

    if (!rawPhone) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Normalize and validate
    const normalizedPhone = rawPhone.replace(/\D/g, '')
    const validatedPhone = validateWebhookData(
      normalizedPhone,
      webhookPhoneSchema,
      'phone number'
    )

    if (!validatedPhone) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Find person by phone
    const person = await findPersonByContact(null, validatedPhone)
    if (!person) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Get profiles for this person and program
    const profiles = person.programProfiles.filter((p) => p.program === program)

    // Filter out profiles that already have active billing assignments
    const unlinkedProfiles = []
    for (const profile of profiles) {
      const assignments = await getBillingAssignmentsByProfile(profile.id)
      if (assignments.length === 0) {
        unlinkedProfiles.push(profile)
      }
    }

    if (unlinkedProfiles.length === 1) {
      console.log(
        `[WEBHOOK] Found unique profile by normalized phone: ${validatedPhone}. Profile ID: ${unlinkedProfiles[0].id}`
      )
      return {
        profile: unlinkedProfiles[0],
        matchMethod: 'phone',
        validatedEmail: null,
      }
    }

    // No match or ambiguous (multiple profiles with same phone)
    if (unlinkedProfiles.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple profiles found with phone: ${validatedPhone}. Cannot determine unique match.`
      )
    }

    return { profile: null, matchMethod: null, validatedEmail: null }
  }

  /**
   * Attempts to find a profile by the payer's email address.
   * Also returns the validated email for potential profile record updates.
   * Only returns a match if exactly one unlinked profile is found.
   */
  private async findByEmail(
    session: Stripe.Checkout.Session,
    program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'
  ): Promise<ProfileMatchResult> {
    const rawEmail = session.customer_details?.email

    if (!rawEmail) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    const validatedEmail = validateWebhookData(
      rawEmail,
      webhookEmailSchema,
      'payer email'
    )

    if (!validatedEmail) {
      return { profile: null, matchMethod: null, validatedEmail: null }
    }

    // Find person by email
    const person = await findPersonByContact(validatedEmail, null)
    if (!person) {
      // No person found, but still return validated email
      return {
        profile: null,
        matchMethod: null,
        validatedEmail,
      }
    }

    // Get profiles for this person and program
    const profiles = person.programProfiles.filter((p) => p.program === program)

    // Filter out profiles that already have active billing assignments
    const unlinkedProfiles = []
    for (const profile of profiles) {
      const assignments = await getBillingAssignmentsByProfile(profile.id)
      if (assignments.length === 0) {
        unlinkedProfiles.push(profile)
      }
    }

    if (unlinkedProfiles.length === 1) {
      console.log(
        `[WEBHOOK] Found unique profile by payer email: ${validatedEmail}. Profile ID: ${unlinkedProfiles[0].id}`
      )
      return {
        profile: unlinkedProfiles[0],
        matchMethod: 'email',
        validatedEmail, // Return for potential update
      }
    }

    // No match or ambiguous (multiple profiles with same email)
    if (unlinkedProfiles.length > 1) {
      console.warn(
        `[WEBHOOK] Multiple profiles found with email: ${validatedEmail}. Cannot determine unique match.`
      )
    }

    // No profile found, but still return validated email
    // This can be used to update a profile found by other means
    return {
      profile: null,
      matchMethod: null,
      validatedEmail,
    }
  }

  /**
   * Logs detailed information when no unique profile can be found.
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
      `[WEBHOOK] Could not find a unique, unlinked profile for subscription ${subscriptionId}. ` +
        `Attempted lookup with custom field email: "${emailField?.text?.value || 'N/A'}", ` +
        `phone: "${phoneField?.numeric?.value || 'N/A'}", ` +
        `and payer email: "${session.customer_details?.email || 'N/A'}". Manual review required.`
    )
  }
}

// Export singleton instance for consistent usage across the application
export const profileMatcher = new ProfileMatcher()

// Legacy export for backward compatibility during migration
export const studentMatcher = profileMatcher
