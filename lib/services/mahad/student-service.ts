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
import { normalizeEmail, normalizePhone } from '@/lib/utils/contact-normalization'

const logger = createServiceLogger('mahad-student-service')

/**
 * Admin-side update payload for an existing Mahad student profile.
 * (New-registration writes live in `registration-service.ts`.)
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
    await logError(logger, error, 'Failed to update Mahad student', {
      studentId,
    })
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
 * Withdraw a Mahad student.
 *
 * Soft-delete: marks the program profile WITHDRAWN and ends any active
 * enrollments. The record is preserved for historical/billing reference.
 *
 * Throws `PROFILE_NOT_FOUND` (404) if no Mahad profile exists for `studentId`.
 * The profile/program check runs inside the transaction to prevent a race where
 * a concurrent update changes the profile between precheck and write.
 *
 * @param studentId - Program profile ID
 * @returns The withdrawn program profile
 */
export async function deleteMahadStudent(studentId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const profile = await getProgramProfileById(studentId, tx)

      if (!profile || profile.program !== MAHAD_PROGRAM) {
        throw new ActionError(
          'Mahad student profile not found',
          ERROR_CODES.PROFILE_NOT_FOUND,
          undefined,
          404
        )
      }

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
    if (error instanceof ActionError) throw error
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new ActionError(
        'Mahad student profile not found',
        ERROR_CODES.PROFILE_NOT_FOUND,
        undefined,
        404
      )
    }
    await logError(logger, error, 'Failed to delete Mahad student', {
      studentId,
    })
    throw error
  }
}
