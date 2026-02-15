/**
 * Dugsi Child Service
 *
 * Dugsi-specific child/student management operations.
 * Handles operations specific to Dugsi students.
 *
 * Responsibilities:
 * - Get Dugsi student information
 * - Manage student enrollments
 * - Handle family relationships
 * - Get student billing status
 */

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { programProfileFullInclude } from '@/lib/db/prisma-helpers'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'

const _logger = createServiceLogger('dugsi-child')

/**
 * Get a Dugsi student by ID.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param studentId - Person ID of the student
 * @returns Student with program profile and relationships
 */
export async function getDugsiStudent(studentId: string) {
  const person = await prisma.person.findUnique({
    relationLoadStrategy: 'join',
    where: { id: studentId },
    include: {
      contactPoints: true,
      programProfiles: {
        where: { program: DUGSI_PROGRAM },
        include: programProfileFullInclude,
      },
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
  })

  if (!person) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Explicit empty check before array access for safety
  if (person.programProfiles.length === 0) {
    throw new ActionError(
      'Student does not have a Dugsi profile',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }
  const dugsiProfile = person.programProfiles[0]!

  return {
    person,
    profile: dugsiProfile,
    guardians: person.guardianRelationships.map((rel) => rel.guardian),
  }
}

/**
 * Get all Dugsi students in a family.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param familyReferenceId - Family reference ID
 * @returns Array of students in the family
 */
export async function getDugsiFamilyStudents(familyReferenceId: string) {
  return await prisma.programProfile.findMany({
    relationLoadStrategy: 'join',
    where: {
      program: DUGSI_PROGRAM,
      familyReferenceId,
    },
    include: {
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
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
        },
        include: {
          batch: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: true,
        },
      },
    },
  })
}

/**
 * Get Dugsi student billing status.
 *
 * Returns subscription and payment information for a student.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param studentId - Person ID of the student
 * @returns Billing status information
 */
export async function getDugsiStudentBillingStatus(studentId: string) {
  const profile = await prisma.programProfile.findFirst({
    relationLoadStrategy: 'join',
    where: {
      personId: studentId,
      program: DUGSI_PROGRAM,
    },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          subscription: {
            include: {
              billingAccount: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!profile) {
    throw new ActionError(
      'Dugsi profile not found for student',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  // Safe access - assignments may be empty if no billing is set up
  const activeAssignment =
    profile.assignments.length > 0 ? profile.assignments[0] : null
  const subscription = activeAssignment?.subscription ?? null
  const billingAccount = subscription?.billingAccount ?? null

  return {
    hasActiveSubscription: subscription !== null,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionAmount: activeAssignment?.amount ?? null,
    paidUntil: subscription?.paidUntil ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    stripeCustomerId: billingAccount?.stripeCustomerIdDugsi ?? null,
    paymentMethodCaptured: billingAccount?.paymentMethodCaptured ?? false,
  }
}

/**
 * Get Dugsi enrollment status for a student.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param studentId - Person ID of the student
 * @returns Enrollment information
 */
export async function getDugsiEnrollmentStatus(studentId: string) {
  const profile = await prisma.programProfile.findFirst({
    relationLoadStrategy: 'join',
    where: {
      personId: studentId,
      program: DUGSI_PROGRAM,
    },
    include: {
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        include: {
          batch: true,
        },
      },
    },
  })

  if (!profile) {
    throw new ActionError(
      'Dugsi profile not found for student',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  // Safe access - enrollments may be empty
  const activeEnrollment =
    profile.enrollments.length > 0 ? profile.enrollments[0] : null

  return {
    isEnrolled: activeEnrollment !== null,
    enrollmentStatus: activeEnrollment?.status ?? null,
    batchName: activeEnrollment?.batch?.name ?? null,
    startDate: activeEnrollment?.startDate ?? null,
    endDate: activeEnrollment?.endDate ?? null,
  }
}

/**
 * Update Dugsi student information.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *           This service does not verify the caller has permission to modify.
 *
 * @param studentId - Person ID of the student
 * @param data - Student update data (at least one field required)
 * @returns Updated person record
 * @throws ActionError if studentId is invalid or no update data provided
 */
export async function updateDugsiStudent(
  studentId: string,
  data: {
    name?: string
    dateOfBirth?: Date
  }
) {
  // Validate inputs
  if (!studentId?.trim()) {
    throw new ActionError(
      'Student ID is required',
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  // Ensure at least one field is being updated
  if (!data.name && !data.dateOfBirth) {
    throw new ActionError(
      'At least one field must be provided for update',
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  return await prisma.person.update({
    where: { id: studentId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
    },
  })
}
