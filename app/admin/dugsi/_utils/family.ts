/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Get family key from registration
 * Priority: familyReferenceId > parentEmail > id
 *
 * This function is used for grouping registrations into families in the UI.
 * It uses a simplified approach that prioritizes explicit family references
 * (familyReferenceId) or parent email for consistency.
 *
 * @see getFamilyPhoneNumbers - Used for database queries with phone-based matching
 *
 * Note: This differs from getFamilyMembers in actions.ts which uses phone numbers
 * for sibling lookup. getFamilyKey is optimized for UI grouping where email/id
 * provides better consistency, while phone-based matching is better for database
 * queries where siblings might have different emails but share phone numbers.
 */
export function getFamilyKey(registration: DugsiRegistration): string {
  return (
    registration.familyReferenceId ||
    registration.parentEmail ||
    registration.id
  )
}

/**
 * Group registrations by family
 * Sorts members by creation date (oldest first)
 */
export function groupRegistrationsByFamily(
  registrations: DugsiRegistration[]
): Family[] {
  const groups = new Map<string, DugsiRegistration[]>()

  // Group by family key
  for (const reg of registrations) {
    const key = getFamilyKey(reg)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(reg)
  }

  // Convert to Family objects
  return Array.from(groups.entries()).map(([key, members]) => {
    const sorted = members.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return {
      familyKey: key,
      members: sorted,
      hasPayment: sorted.some((m) => m.paymentMethodCaptured),
      hasSubscription: sorted.some(
        (m) => m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'active'
      ),
      parentEmail: sorted[0]?.parentEmail ?? null,
      parentPhone: sorted[0]?.parentPhone ?? null,
    }
  })
}

/**
 * Calculate family status
 */
export function getFamilyStatus(family: Family): FamilyStatus {
  if (family.hasSubscription) return 'active'
  if (family.hasPayment) return 'pending'
  return 'no-payment'
}

/**
 * Get phone numbers for family lookup
 * Used by actions.ts for consistent family identification
 *
 * This function is used for database queries to find siblings based on phone numbers.
 * It differs from getFamilyKey() which uses email/id for UI grouping.
 *
 * **Why phone-based matching for database queries?**
 * - Siblings often share parent phone numbers but may have different emails
 * - Phone numbers are more reliable for family identification in real-world scenarios
 * - Allows finding siblings even when email addresses differ between registrations
 *
 * **Why email-based grouping for UI?**
 * - Provides better consistency when families are explicitly linked via email
 * - Prevents grouping unrelated students who happen to share a phone number
 * - Better performance for UI rendering (email/id lookups are faster)
 *
 * @see getFamilyKey - Used for UI grouping with email/id prioritization
 */
export function getFamilyPhoneNumbers(
  registration:
    | DugsiRegistration
    | { parentPhone: string | null; parent2Phone: string | null }
): string[] {
  return [registration.parentPhone, registration.parent2Phone].filter(
    (phone): phone is string => Boolean(phone)
  )
}
