/**
 * Mahad Student Service
 *
 * Business logic for Mahad student management operations.
 * Handles student profile creation, updates, and retrieval.
 *
 * Responsibilities:
 * - Create student program profiles
 * - Update student information
 * - Get student details
 * - Manage student contact information
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Prisma,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import {
  getProgramProfileById,
  createProgramProfile,
} from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

/**
 * Student creation input
 */
export interface StudentCreateInput {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  // Mahad billing fields
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
  batchId?: string | null
}

/**
 * Student update input
 */
export interface StudentUpdateInput {
  name?: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  // Mahad billing fields
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
}

/**
 * Create a new Mahad student.
 *
 * Creates:
 * 1. Person record
 * 2. ContactPoints for email/phone
 * 3. ProgramProfile for MAHAD_PROGRAM
 * 4. (Optional) Enrollment in batch
 *
 * @param input - Student creation data
 * @returns Created program profile
 */
export async function createMahadStudent(input: StudentCreateInput) {
  const normalizedEmail = input.email?.toLowerCase().trim() ?? null
  const normalizedPhone = input.phone?.trim() ?? null

  return prisma.$transaction(async (tx) => {
    let person
    if (normalizedEmail) {
      person = await tx.person.findFirst({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: normalizedEmail,
            },
          },
        },
      })
    }

    if (!person) {
      const contactPoints = []

      if (normalizedEmail) {
        contactPoints.push({
          type: 'EMAIL' as const,
          value: normalizedEmail,
          isPrimary: true,
        })
      }

      if (normalizedPhone) {
        contactPoints.push({
          type: 'PHONE' as const,
          value: normalizedPhone,
        })
      }

      person = await tx.person.create({
        data: {
          name: input.name,
          dateOfBirth: input.dateOfBirth ?? null,
          contactPoints: {
            create: contactPoints,
          },
        },
      })
    }

    const profile = await createProgramProfile(
      {
        personId: person.id,
        program: MAHAD_PROGRAM,
        gradeLevel: input.gradeLevel ?? null,
        schoolName: input.schoolName ?? null,
      },
      tx
    )

    if (
      input.graduationStatus !== undefined ||
      input.paymentFrequency !== undefined ||
      input.billingType !== undefined ||
      input.paymentNotes !== undefined
    ) {
      await tx.programProfile.update({
        where: { id: profile.id },
        data: {
          graduationStatus: input.graduationStatus ?? null,
          paymentFrequency: input.paymentFrequency ?? null,
          billingType: input.billingType ?? null,
          paymentNotes: input.paymentNotes ?? null,
        },
      })
    }

    if (input.batchId) {
      await tx.enrollment.create({
        data: {
          programProfileId: profile.id,
          batchId: input.batchId,
          status: 'ENROLLED',
          startDate: new Date(),
        },
      })
    }

    return profile
  })
}

/**
 * Update Mahad student information.
 *
 * Updates:
 * - Person name and dateOfBirth
 * - ContactPoints (email/phone)
 * - ProgramProfile fields
 *
 * @param studentId - Program profile ID
 * @param input - Student update data
 * @returns Updated program profile
 */
export async function updateMahadStudent(
  studentId: string,
  input: StudentUpdateInput
) {
  // Get profile to access personId
  const profile = await getProgramProfileById(studentId)

  if (!profile || profile.program !== MAHAD_PROGRAM) {
    throw new ActionError(
      'Mahad student profile not found',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  // Update person if name or dateOfBirth changed
  if (input.name !== undefined || input.dateOfBirth !== undefined) {
    await prisma.person.update({
      where: { id: profile.personId },
      data: {
        name: input.name,
        dateOfBirth: input.dateOfBirth,
      },
    })
  }

  // Update email if provided (with P2002 race condition handling)
  if (input.email !== undefined) {
    const normalizedEmail = input.email?.toLowerCase().trim() ?? null

    if (normalizedEmail) {
      // Find existing email contact point
      const existingEmail = await prisma.contactPoint.findFirst({
        where: {
          personId: profile.personId,
          type: 'EMAIL',
        },
      })

      if (existingEmail) {
        await prisma.contactPoint.update({
          where: { id: existingEmail.id },
          data: { value: normalizedEmail },
        })
      } else {
        try {
          await prisma.contactPoint.create({
            data: {
              personId: profile.personId,
              type: 'EMAIL',
              value: normalizedEmail,
              isPrimary: true,
            },
          })
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Race condition - contact point was created by another transaction
            const existing = await prisma.contactPoint.findFirst({
              where: { personId: profile.personId, type: 'EMAIL' },
            })
            if (existing) {
              await prisma.contactPoint.update({
                where: { id: existing.id },
                data: { value: normalizedEmail },
              })
            }
          } else {
            throw error
          }
        }
      }
    }
  }

  // Update phone if provided (with P2002 race condition handling)
  if (input.phone !== undefined) {
    const normalizedPhone = input.phone?.trim() ?? null

    if (normalizedPhone) {
      const existingPhone = await prisma.contactPoint.findFirst({
        where: {
          personId: profile.personId,
          type: 'PHONE',
        },
      })

      if (existingPhone) {
        await prisma.contactPoint.update({
          where: { id: existingPhone.id },
          data: { value: normalizedPhone },
        })
      } else {
        try {
          await prisma.contactPoint.create({
            data: {
              personId: profile.personId,
              type: 'PHONE',
              value: normalizedPhone,
            },
          })
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Race condition - contact point was created by another transaction
            const existing = await prisma.contactPoint.findFirst({
              where: { personId: profile.personId, type: 'PHONE' },
            })
            if (existing) {
              await prisma.contactPoint.update({
                where: { id: existing.id },
                data: { value: normalizedPhone },
              })
            }
          } else {
            throw error
          }
        }
      }
    }
  }

  // Update program profile fields
  return await prisma.programProfile.update({
    where: { id: studentId },
    data: {
      gradeLevel: input.gradeLevel,
      schoolName: input.schoolName,
      graduationStatus: input.graduationStatus,
      paymentFrequency: input.paymentFrequency,
      billingType: input.billingType,
      paymentNotes: input.paymentNotes,
    },
  })
}

/**
 * Get Mahad student by ID.
 *
 * @param studentId - Program profile ID
 * @returns Student with enrollment and contact information
 */
export async function getMahadStudent(studentId: string) {
  const profile = await prisma.programProfile.findUnique({
    where: { id: studentId },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
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

  if (!profile || profile.program !== MAHAD_PROGRAM) {
    throw new ActionError(
      'Mahad student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  return profile
}

/**
 * Get siblings for a Mahad student.
 *
 * Returns other students who share a parent with this student.
 *
 * @param studentId - Program profile ID
 * @returns Array of sibling program profiles
 */
export async function getMahadStudentSiblings(studentId: string) {
  const profile = await getProgramProfileById(studentId)

  if (!profile) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  return await getPersonSiblings(profile.personId)
}

/**
 * Delete Mahad student.
 *
 * Soft delete - marks as inactive and withdraws from enrollments.
 *
 * @param studentId - Program profile ID
 * @returns Deleted profile
 */
export async function deleteMahadStudent(studentId: string) {
  // Withdraw from active enrollments
  await prisma.enrollment.updateMany({
    where: {
      programProfileId: studentId,
      status: { not: 'WITHDRAWN' },
    },
    data: {
      status: 'WITHDRAWN',
      endDate: new Date(),
    },
  })

  // Mark program profile as withdrawn
  return await prisma.programProfile.update({
    where: { id: studentId },
    data: {
      status: 'WITHDRAWN',
    },
  })
}
