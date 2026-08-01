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

import { Prisma, SubscriptionStatus } from '@prisma/client'

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

// Statuses where Stripe may still collect payment. Excludes canceled,
// paused (no billing), and incomplete_expired (terminal — never activated).
export const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'incomplete',
  'active',
  'trialing',
  'past_due',
  'unpaid',
]

/**
 * Filter for active billing assignments with a live subscription.
 * Excludes assignments tied to canceled/expired subscriptions whose
 * isActive flag was never flipped.
 */
export const ACTIVE_BILLING_ASSIGNMENT_WHERE = {
  isActive: true,
  subscription: {
    status: { in: LIVE_SUBSCRIPTION_STATUSES },
  },
} satisfies Prisma.BillingAssignmentWhereInput

/**
 * Filter for active guardian relationships
 */
export const ACTIVE_GUARDIAN_WHERE = {
  isActive: true,
} satisfies Prisma.GuardianRelationshipWhereInput

// ============================================================================
// Common Include Patterns (using Prisma.validator for type safety)
// ============================================================================

/**
 * Include person with all relations (guardian relationships)
 */
export const PERSON_WITH_RELATIONS_INCLUDE =
  Prisma.validator<Prisma.PersonInclude>()({
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
 * ProgramProfile with person - used in enrollment queries
 */
export const ENROLLMENT_WITH_PROFILE_INCLUDE =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: true,
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
 * Teacher with person
 */
export const TEACHER_WITH_PERSON_INCLUDE =
  Prisma.validator<Prisma.TeacherInclude>()({
    person: true,
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
