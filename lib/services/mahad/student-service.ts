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
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

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
 * 4. Enrollment record (with optional batch assignment)
 *
 * @param input - Student creation data
 * @returns Created program profile
 */
export async function createMahadStudent(input: StudentCreateInput) {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = input.phone
    ? (normalizePhone(input.phone) ?? null)
    : null

  return prisma.$transaction(async (tx) => {
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
        ERROR_CODES.DUPLICATE_EMAIL,
        dupResult.duplicateField ?? 'email',
        409
      )
    }

    let personId: string

    if (dupResult.existingPerson) {
      personId = dupResult.existingPerson.id

      if (normalizedEmail) {
        const emailContact = dupResult.existingPerson.contactPoints.find(
          (cp) => cp.type === 'EMAIL' && cp.value === normalizedEmail
        )
        if (emailContact && !emailContact.isActive) {
          await tx.contactPoint.update({
            where: { id: emailContact.id },
            data: { isActive: true, deactivatedAt: null },
          })
        } else if (!emailContact) {
          await tx.contactPoint.create({
            data: {
              personId,
              type: 'EMAIL',
              value: normalizedEmail,
              isPrimary: true,
            },
          })
        }
      }

      if (normalizedPhone) {
        const phoneContact = dupResult.existingPerson.contactPoints.find(
          (cp) => cp.type === 'PHONE' && cp.value === normalizedPhone
        )
        if (phoneContact && !phoneContact.isActive) {
          await tx.contactPoint.update({
            where: { id: phoneContact.id },
            data: { isActive: true, deactivatedAt: null },
          })
        } else if (!phoneContact) {
          await tx.contactPoint.create({
            data: {
              personId,
              type: 'PHONE',
              value: normalizedPhone,
            },
          })
        }
      }
    } else {
      const contactPoints: {
        type: 'EMAIL' | 'PHONE'
        value: string
        isPrimary?: boolean
      }[] = []

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

      const newPerson = await tx.person.create({
        data: {
          name: input.name,
          dateOfBirth: input.dateOfBirth ?? null,
          contactPoints: {
            create: contactPoints,
          },
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

    if (input.name !== undefined || input.dateOfBirth !== undefined) {
      await tx.person.update({
        where: { id: personId },
        data: {
          name: input.name,
          dateOfBirth: input.dateOfBirth,
        },
      })
    }

    if (input.email !== undefined) {
      const normalizedEmail = normalizeEmail(input.email)

      if (normalizedEmail) {
        const existingEmail = await tx.contactPoint.findFirst({
          where: {
            personId: personId,
            type: 'EMAIL',
          },
        })

        if (existingEmail) {
          await tx.contactPoint.update({
            where: { id: existingEmail.id },
            data: { value: normalizedEmail },
          })
        } else {
          try {
            await tx.contactPoint.create({
              data: {
                personId: personId,
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
              const existing = await tx.contactPoint.findFirst({
                where: { personId: personId, type: 'EMAIL' },
              })
              if (existing) {
                await tx.contactPoint.update({
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

    if (input.phone !== undefined) {
      const normalizedPhone = input.phone
        ? (normalizePhone(input.phone) ?? null)
        : null

      if (normalizedPhone) {
        const existingPhone = await tx.contactPoint.findFirst({
          where: {
            personId: personId,
            type: 'PHONE',
          },
        })

        if (existingPhone) {
          await tx.contactPoint.update({
            where: { id: existingPhone.id },
            data: { value: normalizedPhone },
          })
        } else {
          try {
            await tx.contactPoint.create({
              data: {
                personId: personId,
                type: 'PHONE',
                value: normalizedPhone,
              },
            })
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              const existing = await tx.contactPoint.findFirst({
                where: { personId: personId, type: 'PHONE' },
              })
              if (existing) {
                await tx.contactPoint.update({
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

  if (client !== prisma) {
    return performUpdate(client)
  }

  return prisma.$transaction(performUpdate)
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
