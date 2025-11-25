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

import { EducationLevel, GradeLevel, Prisma } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import {
  getProgramProfileById,
  createProgramProfile,
} from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import { mapEnrollmentToMahadStudent as _mapEnrollmentToMahadStudent } from '@/lib/mappers/mahad-mapper'

/**
 * Student creation input
 */
export interface StudentCreateInput {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
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
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
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
  // Normalize email and phone
  const normalizedEmail = input.email?.toLowerCase().trim() ?? null
  const normalizedPhone = input.phone?.trim() ?? null

  // Check if person already exists by email
  let person
  if (normalizedEmail) {
    person = await prisma.person.findFirst({
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

  // Create person if doesn't exist
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

    person = await prisma.person.create({
      data: {
        name: input.name,
        dateOfBirth: input.dateOfBirth ?? null,
        contactPoints: {
          create: contactPoints,
        },
      },
    })
  }

  // Create program profile
  const profile = await createProgramProfile({
    personId: person.id,
    program: MAHAD_PROGRAM,
    educationLevel: input.educationLevel ?? null,
    gradeLevel: input.gradeLevel ?? null,
    schoolName: input.schoolName ?? null,
  })

  // Update monthly rate if custom rate provided
  if (input.monthlyRate !== undefined || input.customRate !== undefined) {
    await prisma.programProfile.update({
      where: { id: profile.id },
      data: {
        monthlyRate: input.monthlyRate ?? 150,
        customRate: input.customRate ?? false,
      },
    })
  }

  // Create enrollment if batch specified
  if (input.batchId) {
    await prisma.enrollment.create({
      data: {
        programProfileId: profile.id,
        batchId: input.batchId,
        status: 'ENROLLED',
        startDate: new Date(),
      },
    })
  }

  return profile
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
    throw new Error('Mahad student profile not found')
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
      educationLevel: input.educationLevel,
      gradeLevel: input.gradeLevel,
      schoolName: input.schoolName,
      monthlyRate: input.monthlyRate,
      customRate: input.customRate,
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
    throw new Error('Mahad student not found')
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
    throw new Error('Student not found')
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
