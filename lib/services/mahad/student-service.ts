import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Prisma,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import type { DatabaseClient } from '@/lib/db/types'
import {
  ActionError,
  ERROR_CODES,
  throwIfP2002,
} from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

const logger = createServiceLogger('mahad-student-service')

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
 * 1. Person record (with email/phone)
 * 2. ProgramProfile for MAHAD_PROGRAM
 * 3. Enrollment record (with optional batch assignment)
 *
 * @param input - Student creation data
 * @returns Created program profile
 */
export async function createMahadStudent(input: StudentCreateInput) {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = input.phone
    ? (normalizePhone(input.phone) ?? null)
    : null

  try {
    return await prisma.$transaction(async (tx) => {
      const dupResult = await DuplicateDetectionService.checkDuplicate(
        {
          email: normalizedEmail,
          phone: normalizedPhone,
          program: MAHAD_PROGRAM,
        },
        tx
      )

      if (dupResult.isDuplicate && dupResult.hasActiveProfile) {
        throw new ActionError(
          'Student already registered for Mahad',
          ERROR_CODES.DUPLICATE_CONTACT,
          dupResult.duplicateField === 'both'
            ? 'email'
            : (dupResult.duplicateField ?? 'email'),
          409
        )
      }

      let personId: string

      if (dupResult.existingPerson) {
        personId = dupResult.existingPerson.id

        const contactUpdates: Prisma.PersonUpdateInput = {}
        if (normalizedEmail !== null && !dupResult.existingPerson.email)
          contactUpdates.email = normalizedEmail
        if (normalizedPhone !== null && !dupResult.existingPerson.phone)
          contactUpdates.phone = normalizedPhone

        if (Object.keys(contactUpdates).length > 0) {
          await tx.person.update({
            where: { id: personId },
            data: contactUpdates,
          })
        }
      } else {
        const newPerson = await tx.person.create({
          data: {
            name: input.name,
            dateOfBirth: input.dateOfBirth ?? null,
            email: normalizedEmail,
            phone: normalizedPhone,
          },
        })
        personId = newPerson.id
      }

      const profile = await tx.programProfile.create({
        data: {
          personId,
          program: MAHAD_PROGRAM,
          gradeLevel: input.gradeLevel ?? null,
          schoolName: input.schoolName ?? null,
          graduationStatus: input.graduationStatus ?? null,
          paymentFrequency: input.paymentFrequency ?? null,
          billingType: input.billingType ?? null,
          paymentNotes: input.paymentNotes ?? null,
        },
      })

      await tx.enrollment.create({
        data: {
          programProfileId: profile.id,
          batchId: input.batchId ?? null,
          status: 'REGISTERED',
          startDate: new Date(),
        },
      })

      return profile
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    throwIfP2002(error)
    throw error
  }
}

/**
 * Update Mahad student information.
 *
 * Updates:
 * - Person (name, dateOfBirth, email, phone)
 * - ProgramProfile fields
 *
 * @param studentId - Program profile ID
 * @param input - Student update data
 * @returns Updated program profile
 */
export async function updateMahadStudent(
  studentId: string,
  input: StudentUpdateInput,
  client: DatabaseClient = prisma
) {
  async function performUpdate(tx: DatabaseClient) {
    const profile = await getProgramProfileById(studentId, tx)

    if (!profile || profile.program !== MAHAD_PROGRAM) {
      throw new ActionError(
        'Mahad student profile not found',
        ERROR_CODES.PROFILE_NOT_FOUND,
        undefined,
        404
      )
    }

    const { personId } = profile

    const personData: Prisma.PersonUpdateInput = {}
    if (input.name !== undefined) personData.name = input.name
    if (input.dateOfBirth !== undefined)
      personData.dateOfBirth = input.dateOfBirth
    if (input.email !== undefined)
      personData.email = normalizeEmail(input.email)
    if (input.phone !== undefined) {
      const normalizedPhone = input.phone ? normalizePhone(input.phone) : null
      if (input.phone && !normalizedPhone) {
        throw new ActionError(
          'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
          ERROR_CODES.VALIDATION_ERROR,
          'phone',
          400
        )
      }
      personData.phone = normalizedPhone
    }

    if (Object.keys(personData).length > 0) {
      await tx.person.update({
        where: { id: personId },
        data: personData,
      })
    }

    return await tx.programProfile.update({
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

  try {
    if (client !== prisma) {
      return await performUpdate(client)
    }
    return await prisma.$transaction(performUpdate)
  } catch (error) {
    if (error instanceof ActionError) throw error
    throwIfP2002(error)
    throw error
  }
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
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          programProfileId: studentId,
          status: { not: 'WITHDRAWN' },
        },
        data: {
          status: 'WITHDRAWN',
          endDate: new Date(),
        },
      })

      return tx.programProfile.update({
        where: { id: studentId },
        data: {
          status: 'WITHDRAWN',
        },
      })
    })
  } catch (error) {
    await logError(logger, error, 'Failed to delete Mahad student', {
      studentId,
    })
    throw error
  }
}
