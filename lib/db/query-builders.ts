/**
 * Query Builder Utilities for Prisma
 *
 * Reusable query fragments that reduce duplication across query files.
 * Uses Prisma.validator<>() for compile-time type safety.
 *
 * Benefits:
 * - Single source of truth for common query patterns
 * - Type-safe at compile time (not runtime casting)
 * - Reduces copy-paste errors
 * - Easy to update when schema changes
 */

import { Prisma } from '@prisma/client'

// ============================================================================
// Common Where Clause Patterns
// ============================================================================

/**
 * Filter for active enrollments (not withdrawn, no end date)
 *
 * Usage:
 * ```typescript
 * await client.enrollment.findMany({
 *   where: ACTIVE_ENROLLMENT_WHERE,
 * })
 * ```
 */
export const ACTIVE_ENROLLMENT_WHERE = {
  status: { not: 'WITHDRAWN' as const },
  endDate: null,
} satisfies Prisma.EnrollmentWhereInput

/**
 * Filter for active Mahad enrollments (program-specific)
 *
 * Usage:
 * ```typescript
 * await client.enrollment.count({
 *   where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
 * })
 * ```
 */
export const ACTIVE_MAHAD_ENROLLMENT_WHERE = {
  ...ACTIVE_ENROLLMENT_WHERE,
  programProfile: {
    program: 'MAHAD_PROGRAM' as const,
  },
} satisfies Prisma.EnrollmentWhereInput

/**
 * Filter for active Dugsi enrollments
 */
export const ACTIVE_DUGSI_ENROLLMENT_WHERE = {
  ...ACTIVE_ENROLLMENT_WHERE,
  programProfile: {
    program: 'DUGSI_PROGRAM' as const,
  },
} satisfies Prisma.EnrollmentWhereInput

/**
 * Filter for active billing assignments
 */
export const ACTIVE_BILLING_ASSIGNMENT_WHERE = {
  isActive: true,
} satisfies Prisma.BillingAssignmentWhereInput

/**
 * Filter for active teacher assignments
 */
export const ACTIVE_TEACHER_ASSIGNMENT_WHERE = {
  isActive: true,
} satisfies Prisma.TeacherAssignmentWhereInput

/**
 * Filter for active guardian relationships
 */
export const ACTIVE_GUARDIAN_WHERE = {
  isActive: true,
} satisfies Prisma.GuardianRelationshipWhereInput

/**
 * Filter for active contact points (soft-delete support)
 *
 * Usage:
 * ```typescript
 * await client.contactPoint.findMany({
 *   where: { personId, ...ACTIVE_CONTACT_WHERE },
 * })
 * ```
 */
export const ACTIVE_CONTACT_WHERE = {
  isActive: true,
} satisfies Prisma.ContactPointWhereInput

// ============================================================================
// Common Include Patterns (using Prisma.validator for type safety)
// ============================================================================

/**
 * Include person with contact points - most common pattern
 *
 * Usage:
 * ```typescript
 * await client.programProfile.findMany({
 *   include: {
 *     person: PERSON_WITH_CONTACTS_INCLUDE,
 *   },
 * })
 * ```
 */
export const PERSON_WITH_CONTACTS_INCLUDE =
  Prisma.validator<Prisma.PersonInclude>()({
    contactPoints: true,
  })

/**
 * Include person with all relations (contacts, guardian relationships)
 */
export const PERSON_WITH_RELATIONS_INCLUDE =
  Prisma.validator<Prisma.PersonInclude>()({
    contactPoints: true,
    guardianRelationships: true,
    dependentRelationships: true,
  })

/**
 * Basic batch select (id, name, dates)
 */
export const BATCH_SELECT = Prisma.validator<Prisma.BatchSelect>()({
  id: true,
  name: true,
  startDate: true,
  endDate: true,
})

/**
 * Full batch select including timestamps
 */
export const BATCH_FULL_SELECT = Prisma.validator<Prisma.BatchSelect>()({
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
})

// ============================================================================
// Composite Include Patterns
// ============================================================================

/**
 * ProgramProfile with person and contacts - used in enrollment queries
 *
 * Usage:
 * ```typescript
 * await client.enrollment.findMany({
 *   include: ENROLLMENT_WITH_PROFILE_INCLUDE,
 * })
 * ```
 */
export const ENROLLMENT_WITH_PROFILE_INCLUDE =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    },
    batch: {
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    },
  })

/**
 * Teacher with person and contacts
 */
export const TEACHER_WITH_PERSON_INCLUDE =
  Prisma.validator<Prisma.TeacherInclude>()({
    person: {
      include: {
        contactPoints: true,
      },
    },
  })

/**
 * Teacher assignment with full relations
 */
export const TEACHER_ASSIGNMENT_FULL_INCLUDE =
  Prisma.validator<Prisma.TeacherAssignmentInclude>()({
    teacher: {
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    },
    programProfile: {
      include: {
        person: true,
      },
    },
  })

// ============================================================================
// Helper Functions for Dynamic Queries
// ============================================================================

/**
 * Build active enrollment where clause with optional batch filter
 *
 * @param batchId - Optional batch ID to filter by
 * @returns Prisma-compatible where clause
 */
export function buildActiveEnrollmentWhere(
  batchId?: string | null
): Prisma.EnrollmentWhereInput {
  return {
    ...ACTIVE_ENROLLMENT_WHERE,
    ...(batchId && { batchId }),
  }
}

/**
 * Build program-specific enrollment where clause
 *
 * @param program - Program type ('MAHAD_PROGRAM' or 'DUGSI_PROGRAM')
 * @param batchId - Optional batch ID filter
 * @returns Prisma-compatible where clause
 */
export function buildProgramEnrollmentWhere(
  program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
  batchId?: string | null
): Prisma.EnrollmentWhereInput {
  return {
    ...ACTIVE_ENROLLMENT_WHERE,
    programProfile: {
      program,
    },
    ...(batchId && { batchId }),
  }
}

// ============================================================================
// Contact Extraction Utilities
// ============================================================================

/**
 * Contact point with minimal required fields
 */
export interface MinimalContactPoint {
  type: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'OTHER'
  value: string
  isPrimary?: boolean
}

/**
 * Extract primary email from contact points array
 *
 * @param contactPoints - Array of contact points
 * @returns Email address or null
 */
export function extractPrimaryEmail(
  contactPoints: MinimalContactPoint[] | null | undefined
): string | null {
  if (!contactPoints) return null
  const email = contactPoints.find(
    (cp) =>
      cp.type === 'EMAIL' &&
      (cp.isPrimary === true || cp.isPrimary === undefined)
  )
  // Fall back to any email if no primary found
  return (
    email?.value ||
    contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
    null
  )
}

/**
 * Extract primary phone from contact points array
 *
 * @param contactPoints - Array of contact points
 * @returns Phone number or null
 */
export function extractPrimaryPhone(
  contactPoints: MinimalContactPoint[] | null | undefined
): string | null {
  if (!contactPoints) return null
  const phone = contactPoints.find(
    (cp) =>
      (cp.type === 'PHONE' || cp.type === 'WHATSAPP') &&
      (cp.isPrimary === true || cp.isPrimary === undefined)
  )
  // Fall back to any phone if no primary found
  return (
    phone?.value ||
    contactPoints.find((cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP')
      ?.value ||
    null
  )
}

/**
 * Extract both primary email and phone from contact points
 *
 * @param contactPoints - Array of contact points
 * @returns Object with email and phone (both nullable)
 */
export function extractContactInfo(
  contactPoints: MinimalContactPoint[] | null | undefined
): { email: string | null; phone: string | null } {
  return {
    email: extractPrimaryEmail(contactPoints),
    phone: extractPrimaryPhone(contactPoints),
  }
}
