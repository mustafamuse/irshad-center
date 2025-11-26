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

/**
 * Get a Dugsi student by ID.
 *
 * @param studentId - Person ID of the student
 * @returns Student with program profile and relationships
 */
export async function getDugsiStudent(studentId: string) {
  const person = await prisma.person.findUnique({
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

  const dugsiProfile = person.programProfiles[0]
  if (!dugsiProfile) {
    throw new ActionError(
      'Student does not have a Dugsi profile',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  return {
    person,
    profile: dugsiProfile,
    guardians: person.guardianRelationships.map((rel) => rel.guardian),
  }
}

/**
 * Get all Dugsi students in a family.
 *
 * @param familyReferenceId - Family reference ID
 * @returns Array of students in the family
 */
export async function getDugsiFamilyStudents(familyReferenceId: string) {
  return await prisma.programProfile.findMany({
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
 * @param studentId - Person ID of the student
 * @returns Billing status information
 */
export async function getDugsiStudentBillingStatus(studentId: string) {
  const profile = await prisma.programProfile.findFirst({
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

  const activeAssignment = profile.assignments[0]
  const subscription = activeAssignment?.subscription
  const billingAccount = subscription?.billingAccount

  return {
    hasActiveSubscription: !!subscription,
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
 * @param studentId - Person ID of the student
 * @returns Enrollment information
 */
export async function getDugsiEnrollmentStatus(studentId: string) {
  const profile = await prisma.programProfile.findFirst({
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

  const activeEnrollment = profile.enrollments[0]

  return {
    isEnrolled: !!activeEnrollment,
    enrollmentStatus: activeEnrollment?.status ?? null,
    batchName: activeEnrollment?.batch?.name ?? null,
    startDate: activeEnrollment?.startDate ?? null,
    endDate: activeEnrollment?.endDate ?? null,
  }
}

/**
 * Update Dugsi student information.
 *
 * @param studentId - Person ID of the student
 * @param data - Student update data
 * @returns Updated person record
 */
export async function updateDugsiStudent(
  studentId: string,
  data: {
    name?: string
    dateOfBirth?: Date
  }
) {
  return await prisma.person.update({
    where: { id: studentId },
    data: {
      name: data.name,
      dateOfBirth: data.dateOfBirth,
    },
  })
}
