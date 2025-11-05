/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Get family key from registration - SINGLE SOURCE OF TRUTH for family identification.
 * Priority: familyReferenceId > parentEmail > id
 *
 * This function defines how families are grouped throughout the application:
 * - **UI grouping**: Groups students into families for display
 * - **Database operations**: Determines which students are affected by deletions/updates
 *
 * **How it works:**
 * 1. If `familyReferenceId` exists, all students with the same ID are one family
 * 2. If no `familyReferenceId`, students with the same `parentEmail` are one family
 * 3. If neither exists, each student is their own family (fallback to `id`)
 *
 * **Aligned server actions:**
 * - `getFamilyMembers()` - Uses this exact logic to fetch family members
 * - `deleteDugsiFamily()` - Uses this exact logic to determine what to delete
 * - `getDeleteFamilyPreview()` - Uses this exact logic to show delete preview
 *
 * **Why this matters:**
 * This ensures UI-database consistency. When you see a family in the UI,
 * any operation (delete, update) will affect exactly those students shown.
 * No hidden surprises, no accidental data loss.
 *
 * @see groupRegistrationsByFamily - Uses this function for UI grouping
 * @see getFamilyMembers - Server action that mirrors this logic
 * @see deleteDugsiFamily - Server action that mirrors this logic
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
 * @deprecated Phone-based family matching is deprecated in favor of familyReferenceId-based matching.
 *
 *
 * Previous versions used phone number matching for database queries to find family members.
 * This approach had a critical flaw: if a parent registered different children with the same
 * phone number but different emails, the UI would show them as separate families, but
 * deletion/updates would affect all students with matching phone numbers.
 *
 * **Migration:**
 * All family identification now uses the same logic as getFamilyKey():
 * - Priority: familyReferenceId > parentEmail > id
 * - See: getFamilyMembers(), deleteDugsiFamily(), getDeleteFamilyPreview()
 *
 * **Why this was changed:**
 * - UI-database consistency: What you see in the UI is what gets deleted/updated
 * - Predictable behavior: Family grouping is transparent and consistent
 * - Safer deletions: No risk of accidentally deleting unrelated students
 *
 * **Risk of phone-based matching:**
 * Example scenario that caused issues:
 * - Day 1: Parent registers 2 kids with email parent1@gmail.com, phone 555-1234
 * - Day 30: Same parent registers 1 kid with email parent2@gmail.com, same phone
 * - UI shows: 2 separate families (grouped by email)
 * - Old deletion logic: Would delete all 3 kids (matched by phone)
 * - Result: Unexpected data loss
 *
 * @see getFamilyKey - Current source of truth for family identification
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
