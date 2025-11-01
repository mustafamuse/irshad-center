/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Get family key from registration
 * Priority: familyReferenceId > parentEmail > id
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
 */
export function getFamilyPhoneNumbers(
  registration: DugsiRegistration | { parentPhone: string | null; parent2Phone: string | null }
): string[] {
  return [registration.parentPhone, registration.parent2Phone].filter(
    (phone): phone is string => Boolean(phone)
  )
}
