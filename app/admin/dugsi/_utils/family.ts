/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { formatFullName } from '@/lib/utils/formatters'

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
      hasChurned: sorted.some(
        (m) =>
          m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'canceled'
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
  if (family.hasChurned) return 'churned'
  return 'no-payment'
}

/**
 * Result of primary payer phone resolution
 */
export interface PrimaryPayerPhoneResult {
  phone: string | null
  usedFallback: boolean
  fallbackReason?: 'primary_payer_not_set' | 'primary_payer_phone_missing'
}

/**
 * Get the primary payer's phone number for WhatsApp payment links.
 *
 * Resolution order:
 * 1. If primaryPayerParentNumber === 2: use parent2Phone, fallback to parentPhone
 * 2. If primaryPayerParentNumber === 1 or null: use parentPhone, fallback to parent2Phone
 * 3. Final fallback: family.parentPhone
 *
 * @param family - The family object containing members with phone data
 * @returns The resolved phone number and metadata about fallback usage
 */
export function getPrimaryPayerPhone(family: Family): PrimaryPayerPhoneResult {
  const member = family.members[0]

  if (!member) {
    return {
      phone: family.parentPhone,
      usedFallback: true,
      fallbackReason: 'primary_payer_not_set',
    }
  }

  const { primaryPayerParentNumber, parentPhone, parent2Phone } = member
  const isPrimaryPayerParent2 = primaryPayerParentNumber === 2

  if (isPrimaryPayerParent2) {
    if (parent2Phone) {
      return { phone: parent2Phone, usedFallback: false }
    }
    return {
      phone: parentPhone,
      usedFallback: true,
      fallbackReason: 'primary_payer_phone_missing',
    }
  }

  if (primaryPayerParentNumber === null) {
    return {
      phone: parentPhone || parent2Phone,
      usedFallback: true,
      fallbackReason: 'primary_payer_not_set',
    }
  }

  if (parentPhone) {
    return { phone: parentPhone, usedFallback: false }
  }

  return {
    phone: parent2Phone,
    usedFallback: true,
    fallbackReason: 'primary_payer_phone_missing',
  }
}

/**
 * Get the primary payer's full name for WhatsApp messages.
 *
 * Resolution order:
 * 1. If primaryPayerParentNumber === 2: use parent2 name
 * 2. If primaryPayerParentNumber === 1 or null: use parent1 name
 *
 * @param family - The family object containing members with parent data
 * @returns The resolved parent name
 */
export function getPrimaryPayerName(family: Family): string {
  const member = family.members[0]
  if (!member) {
    return 'Parent'
  }

  const {
    primaryPayerParentNumber,
    parentFirstName,
    parentLastName,
    parent2FirstName,
    parent2LastName,
  } = member

  if (primaryPayerParentNumber === 2 && (parent2FirstName || parent2LastName)) {
    return formatFullName(parent2FirstName, parent2LastName, 'Parent')
  }

  return formatFullName(parentFirstName, parentLastName, 'Parent')
}
