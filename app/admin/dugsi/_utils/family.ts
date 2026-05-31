/**
 * Family grouping and manipulation utilities
 * Single source of truth for family identification logic
 */

import { SubscriptionStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { formatFullName } from '@/lib/utils/formatters'

import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Family key for UI grouping and delete/update server actions only.
 * Priority: familyReferenceId > parentEmail > id.
 * The vCard export uses a superset key (adds phone fallback + email normalization).
 * Do not replace the inline vCard key with a call here.
 */
export function getFamilyKey(registration: DugsiRegistration): string {
  return (
    registration.familyReferenceId ||
    registration.parentEmail ||
    registration.id
  )
}

type SubscriptionFields = Pick<
  DugsiRegistration,
  'stripeSubscriptionIdDugsi' | 'subscriptionStatus'
>

export const isActiveDugsiRegistration = (
  member: SubscriptionFields
): boolean =>
  !!member.stripeSubscriptionIdDugsi &&
  member.subscriptionStatus === SubscriptionStatus.active

export const isChurnedDugsiRegistration = (
  member: SubscriptionFields
): boolean =>
  !!member.stripeSubscriptionIdDugsi &&
  member.subscriptionStatus === SubscriptionStatus.canceled

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
      hasSubscription: sorted.some(isActiveDugsiRegistration),
      hasChurned: sorted.some(isChurnedDugsiRegistration),
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

  if (primaryPayerParentNumber === null) {
    return {
      phone: parentPhone || parent2Phone,
      usedFallback: true,
      fallbackReason: 'primary_payer_not_set',
    }
  }

  const isPrimaryParent2 = primaryPayerParentNumber === 2
  const primaryPhone = isPrimaryParent2 ? parent2Phone : parentPhone
  const fallbackPhone = isPrimaryParent2 ? parentPhone : parent2Phone

  if (primaryPhone) {
    return { phone: primaryPhone, usedFallback: false }
  }

  return {
    phone: fallbackPhone,
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
