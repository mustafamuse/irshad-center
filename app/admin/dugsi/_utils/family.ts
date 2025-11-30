/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'

import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Get family key from registration - SINGLE SOURCE OF TRUTH for family identification.
 * Priority: familyReferenceId > parentEmail > id
 *
 * This function defines how families are grouped throughout the application:
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
 * Get Prisma where clause for family-based database operations.
 * Returns the appropriate where clause for updateMany/deleteMany operations,
 * or indicates if it's a single-student operation.
 *
 * Priority: familyReferenceId > parentEmail > single student
 *
 * @param student - Student object with familyReferenceId and parentEmail
 * @returns Object with where clause and isSingleStudent flag
 *
 * @example
 * ```typescript
 * const { where, isSingleStudent } = getFamilyWhereClause(student)
 * if (isSingleStudent) {
 *   await tx.student.update({ where: { id: studentId }, data })
 * } else {
 *   await tx.student.updateMany({ where, data })
 * }
 * ```
 */
export function getFamilyWhereClause(student: {
  familyReferenceId: string | null
  parentEmail: string | null
}): {
  where:
    | {
        program: typeof DUGSI_PROGRAM
        familyReferenceId: string
      }
    | {
        program: typeof DUGSI_PROGRAM
        parentEmail: string
        familyReferenceId: null
      }
    | null
  isSingleStudent: boolean
} {
  if (student.familyReferenceId) {
    // Match by familyReferenceId
    return {
      where: {
        program: DUGSI_PROGRAM,
        familyReferenceId: student.familyReferenceId,
      },
      isSingleStudent: false,
    }
  }

  if (student.parentEmail) {
    // Match by parentEmail (only students without familyReferenceId)
    return {
      where: {
        program: DUGSI_PROGRAM,
        parentEmail: student.parentEmail,
        familyReferenceId: null,
      },
      isSingleStudent: false,
    }
  }

  // Single student operation
  return {
    where: null,
    isSingleStudent: true,
  }
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
