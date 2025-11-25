/**
 * Prisma Type Helpers
 *
 * This file provides type-safe Prisma query result types to replace `any` usage.
 * Use these types instead of casting to `any` when working with Prisma relations.
 *
 * @example
 * // ❌ Before
 * function transform(profile: any): Result { ... }
 *
 * // ✅ After
 * function transform(profile: ProgramProfileWithPerson): Result { ... }
 */

import { Prisma } from '@prisma/client'

// ============================================================================
// ProgramProfile Types
// ============================================================================

/**
 * ProgramProfile with Person and ContactPoints
 * Common type for student/registration displays
 */
export const programProfileWithPersonInclude =
  Prisma.validator<Prisma.ProgramProfileInclude>()({
    person: {
      include: {
        contactPoints: true,
      },
    },
  })

export type ProgramProfileWithPerson = Prisma.ProgramProfileGetPayload<{
  include: typeof programProfileWithPersonInclude
}>

/**
 * ProgramProfile with all related data (Person, Enrollments, Assignments)
 * Use for detailed views that need full relationship data
 */
export const programProfileFullInclude =
  Prisma.validator<Prisma.ProgramProfileInclude>()({
    person: {
      include: {
        contactPoints: true,
        guardianRelationships: {
          include: {
            guardian: {
              include: {
                contactPoints: true,
              },
            },
          },
        },
      },
    },
    enrollments: {
      include: {
        batch: true,
      },
    },
    assignments: {
      include: {
        subscription: {
          include: {
            billingAccount: true,
          },
        },
      },
    },
  })

export type ProgramProfileFull = Prisma.ProgramProfileGetPayload<{
  include: typeof programProfileFullInclude
}>

/**
 * ProgramProfile with Guardian data (for Dugsi families)
 */
export const programProfileWithGuardiansInclude =
  Prisma.validator<Prisma.ProgramProfileInclude>()({
    person: {
      include: {
        contactPoints: true,
        guardianRelationships: {
          where: { isActive: true },
          include: {
            guardian: {
              include: {
                contactPoints: true,
              },
            },
          },
        },
      },
    },
  })

export type ProgramProfileWithGuardians = Prisma.ProgramProfileGetPayload<{
  include: typeof programProfileWithGuardiansInclude
}>

// ============================================================================
// Enrollment Types
// ============================================================================

/**
 * Enrollment with Batch and ProgramProfile
 */
export const enrollmentWithRelationsInclude =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    batch: true,
    programProfile: {
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    },
  })

export type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentWithRelationsInclude
}>

// ============================================================================
// Billing Types
// ============================================================================

/**
 * BillingAccount with Subscriptions and Person
 */
export const billingAccountWithRelationsInclude =
  Prisma.validator<Prisma.BillingAccountInclude>()({
    person: {
      include: {
        contactPoints: true,
      },
    },
    subscriptions: {
      include: {
        assignments: {
          include: {
            programProfile: true,
          },
        },
      },
    },
  })

export type BillingAccountWithRelations = Prisma.BillingAccountGetPayload<{
  include: typeof billingAccountWithRelationsInclude
}>

/**
 * Subscription with BillingAccount and Assignments
 */
export const subscriptionWithRelationsInclude =
  Prisma.validator<Prisma.SubscriptionInclude>()({
    billingAccount: {
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
      },
    },
    assignments: {
      include: {
        programProfile: {
          include: {
            person: true,
          },
        },
      },
    },
  })

export type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionWithRelationsInclude
}>

// ============================================================================
// Person Types
// ============================================================================

/**
 * Person with all ContactPoints
 */
export const personWithContactsInclude =
  Prisma.validator<Prisma.PersonInclude>()({
    contactPoints: true,
  })

export type PersonWithContacts = Prisma.PersonGetPayload<{
  include: typeof personWithContactsInclude
}>

/**
 * Person with GuardianRelationships (for finding dependents)
 */
export const personWithDependentsInclude =
  Prisma.validator<Prisma.PersonInclude>()({
    contactPoints: true,
    dependentRelationships: {
      where: { isActive: true },
      include: {
        dependent: {
          include: {
            contactPoints: true,
            programProfiles: true,
          },
        },
      },
    },
  })

export type PersonWithDependents = Prisma.PersonGetPayload<{
  include: typeof personWithDependentsInclude
}>

// ============================================================================
// Batch Types (Mahad)
// ============================================================================

/**
 * Batch with Enrollments and Student data
 */
export const batchWithEnrollmentsInclude =
  Prisma.validator<Prisma.BatchInclude>()({
    Enrollment: {
      include: {
        programProfile: {
          include: {
            person: {
              include: {
                contactPoints: true,
              },
            },
          },
        },
      },
    },
  })

export type BatchWithEnrollments = Prisma.BatchGetPayload<{
  include: typeof batchWithEnrollmentsInclude
}>

// ============================================================================
// Teacher Types
// ============================================================================

/**
 * Teacher with Person and Assignments
 */
export const teacherWithRelationsInclude =
  Prisma.validator<Prisma.TeacherInclude>()({
    person: {
      include: {
        contactPoints: true,
      },
    },
    assignments: {
      include: {
        programProfile: {
          include: {
            person: true,
          },
        },
      },
    },
  })

export type TeacherWithRelations = Prisma.TeacherGetPayload<{
  include: typeof teacherWithRelationsInclude
}>

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for Prisma transaction client
 */
export type TransactionClient = Omit<
  typeof import('@prisma/client').PrismaClient.prototype,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>

/**
 * Helper type for service return values
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Helper type for async service return values
 */
export type AsyncServiceResult<T> = Promise<ServiceResult<T>>
