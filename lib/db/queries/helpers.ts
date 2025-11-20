/**
 * Helper Functions for Common Database Operations
 * 
 * Convenience functions that combine validation and common query patterns.
 */

import { prisma } from '@/lib/db'
import type { Program, EnrollmentStatus, Shift } from '@prisma/client'
import { createEnrollment } from './program-profile'
import { createBillingAssignment } from './billing'
// import { createTeacherAssignment } from './teacher' // TODO: Function doesn't exist yet
import { createGuardianRelationship } from './relationships'

/**
 * Calculate total amount assigned for a subscription
 */
export async function calculateBillingAssignmentTotal(
  subscriptionId: string,
  excludeProfileId?: string
): Promise<number> {
  const assignments = await prisma.billingAssignment.findMany({
    where: {
      subscriptionId,
      isActive: true,
      ...(excludeProfileId && {
        programProfileId: { not: excludeProfileId },
      }),
    },
    select: {
      amount: true,
    },
  })

  return assignments.reduce((total, assignment) => total + assignment.amount, 0)
}

/**
 * Get active enrollments for a program profile
 */
export async function getActiveEnrollments(programProfileId: string) {
  return prisma.enrollment.findMany({
    where: {
      programProfileId,
      status: { in: ['REGISTERED', 'ENROLLED'] },
      endDate: null, // Active enrollments don't have endDate
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get all enrollments for a program profile (including inactive)
 */
export async function getAllEnrollments(programProfileId: string) {
  return prisma.enrollment.findMany({
    where: {
      programProfileId,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get active teacher assignments for a Dugsi student
 */
export async function getActiveTeacherAssignments(programProfileId: string) {
  return prisma.teacherAssignment.findMany({
    where: {
      programProfileId,
      isActive: true,
    },
    include: {
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
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get all teacher assignments for a student (including inactive)
 */
export async function getAllTeacherAssignments(programProfileId: string) {
  return prisma.teacherAssignment.findMany({
    where: {
      programProfileId,
    },
    include: {
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
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Create enrollment with automatic batch assignment for Mahad
 */
export async function createEnrollmentWithBatch(
  data: {
    programProfileId: string
    batchId?: string | null
    status?: EnrollmentStatus
    startDate?: Date
    reason?: string | null
    notes?: string | null
  }
) {
  // Get program to determine if batch is required
  const profile = await prisma.programProfile.findUnique({
    where: { id: data.programProfileId },
    select: { program: true },
  })

  if (!profile) {
    throw new Error('Program profile not found')
  }

  // For Mahad, try to find active batch if not provided
  if (profile.program === 'MAHAD_PROGRAM' && !data.batchId) {
    const activeBatch = await prisma.batch.findFirst({
      where: {
        endDate: null, // Active batch
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (activeBatch) {
      data.batchId = activeBatch.id
    }
  }

  return createEnrollment(data)
}

/**
 * Create billing assignment with total validation
 */
export async function createBillingAssignmentWithValidation(data: {
  subscriptionId: string
  programProfileId: string
  amount: number
  percentage?: number | null
  notes?: string | null
  strict?: boolean // If true, throws error on over-assignment
}) {
  const { strict = false, ...assignmentData } = data

  // Calculate current total
  const currentTotal = await calculateBillingAssignmentTotal(
    data.subscriptionId,
    data.programProfileId
  )

  // Get subscription amount
  const subscription = await prisma.subscription.findUnique({
    where: { id: data.subscriptionId },
    select: { amount: true },
  })

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const newTotal = currentTotal + data.amount

  // Strict validation: throw error if exceeds
  if (strict && newTotal > subscription.amount) {
    throw new Error(
      `Total assignments ($${newTotal / 100}) would exceed subscription amount ($${subscription.amount / 100})`
    )
  }

  return createBillingAssignment(assignmentData)
}

/**
 * Create teacher assignment for Dugsi student
 * Convenience wrapper that validates program
 */
export async function createDugsiTeacherAssignment(data: {
  teacherId: string
  programProfileId: string
  shift: Shift
  startDate?: Date
  notes?: string | null
}) {
  // TODO: Implement createTeacherAssignment when teacher assignment model is ready
  throw new Error('createTeacherAssignment not yet implemented')
}

/**
 * Create guardian relationship with validation
 * Convenience wrapper
 */
export async function createParentRelationship(data: {
  guardianId: string
  dependentId: string
  startDate?: Date
  notes?: string | null
}) {
  return createGuardianRelationship({
    ...data,
    role: 'PARENT',
  })
}

/**
 * Get billing assignment summary for a subscription
 */
export async function getBillingAssignmentSummary(subscriptionId: string) {
  const [subscription, assignments] = await Promise.all([
    prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    }),
    prisma.billingAssignment.findMany({
      where: {
        subscriptionId,
        isActive: true,
      },
      include: {
        programProfile: {
          include: {
            person: true,
          },
        },
      },
    }),
  ])

  if (!subscription) {
    return null
  }

  const totalAssigned = assignments.reduce((sum, a) => sum + a.amount, 0)
  const remaining = subscription.amount - totalAssigned
  const percentageUsed = (totalAssigned / subscription.amount) * 100

  return {
    subscription,
    assignments,
    totalAssigned,
    remaining,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    isOverAssigned: totalAssigned > subscription.amount,
    overageAmount: totalAssigned > subscription.amount ? totalAssigned - subscription.amount : 0,
  }
}

/**
 * Get all program profiles for a person
 */
export async function getPersonProgramProfiles(personId: string, program?: Program) {
  return prisma.programProfile.findMany({
    where: {
      personId,
      ...(program && { program }),
    },
    include: {
      person: true,
      enrollments: {
        where: {
          endDate: null, // Active enrollments
        },
        include: {
          batch: true,
        },
      },
      teacherAssignments: {
        where: {
          isActive: true,
        },
        include: {
          teacher: {
            include: {
              person: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Validate and create person with contact points
 */
export async function validateAndCreatePerson(data: {
  name: string
  dateOfBirth?: Date | null
  contactPoints?: Array<{
    type: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'OTHER'
    value: string
    isPrimary?: boolean
  }>
}) {
  // Basic validation
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Person name is required')
  }

  // Validate contact points
  if (data.contactPoints) {
    const emails = data.contactPoints.filter((cp) => cp.type === 'EMAIL')
    const phones = data.contactPoints.filter(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )

    // Check for duplicate emails
    const emailValues = emails.map((cp) => cp.value.toLowerCase().trim())
    if (new Set(emailValues).size !== emailValues.length) {
      throw new Error('Duplicate email addresses')
    }

    // Check for duplicate phones
    const phoneValues = phones.map((cp) => cp.value.replace(/\D/g, ''))
    if (new Set(phoneValues).size !== phoneValues.length) {
      throw new Error('Duplicate phone numbers')
    }
  }

  return prisma.person.create({
    data: {
      name: data.name.trim(),
      dateOfBirth: data.dateOfBirth,
      contactPoints: data.contactPoints
        ? {
            create: data.contactPoints.map((cp) => ({
              type: cp.type,
              value: cp.value.trim(),
              isPrimary: cp.isPrimary || false,
            })),
          }
        : undefined,
    },
    include: {
      contactPoints: true,
    },
  })
}

/**
 * Get enrollment history for a program profile
 */
export async function getEnrollmentHistory(programProfileId: string) {
  return prisma.enrollment.findMany({
    where: {
      programProfileId,
    },
    include: {
      batch: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Check if a person is enrolled in a program
 */
export async function isPersonEnrolled(
  personId: string,
  program: Program
): Promise<boolean> {
  const profile = await prisma.programProfile.findFirst({
    where: {
      personId,
      program,
    },
    include: {
      enrollments: {
        where: {
          status: { in: ['REGISTERED', 'ENROLLED'] },
          endDate: null,
        },
      },
    },
  })

  return profile !== null && profile.enrollments.length > 0
}

/**
 * Get all active students for a teacher
 */
export async function getTeacherStudents(teacherId: string, shift?: Shift) {
  return prisma.teacherAssignment.findMany({
    where: {
      teacherId,
      isActive: true,
      ...(shift && { shift }),
      programProfile: {
        enrollments: {
          some: {
            status: { in: ['REGISTERED', 'ENROLLED'] },
            endDate: null,
          },
        },
      },
    },
    include: {
      programProfile: {
        include: {
          person: true,
          enrollments: {
            where: {
              status: { in: ['REGISTERED', 'ENROLLED'] },
              endDate: null,
            },
          },
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

