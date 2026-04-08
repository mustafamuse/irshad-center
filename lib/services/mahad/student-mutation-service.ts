import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Prisma,
  StudentBillingType,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { ACTIVE_BILLING_ASSIGNMENT_WHERE } from '@/lib/db/query-builders'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { isPrismaError } from '@/lib/utils/type-guards'

export interface UpdateStudentData {
  name?: string
  dateOfBirth?: Date | null
  email?: string | null
  phone?: string | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
  batchId?: string | null
}

export async function deleteStudentProfile(profileId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const liveAssignment = await tx.billingAssignment.findFirst({
        where: {
          programProfileId: profileId,
          ...ACTIVE_BILLING_ASSIGNMENT_WHERE,
        },
      })
      if (liveAssignment) {
        throw new ActionError(
          'Cannot delete student with active billing subscription. Cancel the subscription first.',
          ERROR_CODES.ACTIVE_SUBSCRIPTION,
          undefined,
          403
        )
      }
      await tx.programProfile.delete({ where: { id: profileId } })
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    if (isPrismaError(error)) {
      if (error.code === 'P2025')
        throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
      if (error.code === 'P2003')
        throw new ActionError(
          'Cannot delete student with related records',
          ERROR_CODES.VALIDATION_ERROR
        )
    }
    throw error
  }
}

export async function bulkDeleteStudentProfiles(
  studentIds: string[]
): Promise<{ deletedCount: number; blockedIds: string[] }> {
  const { deletedCount, blockedIds } = await prisma.$transaction(async (tx) => {
    const activeAssignments = await tx.billingAssignment.findMany({
      where: {
        programProfileId: { in: studentIds },
        ...ACTIVE_BILLING_ASSIGNMENT_WHERE,
      },
      select: { programProfileId: true },
    })

    const blockedIdSet = new Set(
      activeAssignments.map((a) => a.programProfileId)
    )
    const safe = studentIds.filter((id) => !blockedIdSet.has(id))
    const blocked = studentIds.filter((id) => blockedIdSet.has(id))

    let deleted = 0
    if (safe.length > 0) {
      const result = await tx.programProfile.deleteMany({
        where: { id: { in: safe } },
      })
      deleted = result.count
    }

    return { deletedCount: deleted, blockedIds: blocked }
  })

  if (deletedCount === 0 && blockedIds.length > 0) {
    throw new ActionError(
      `All ${blockedIds.length} student(s) have active subscriptions and cannot be deleted`,
      ERROR_CODES.ACTIVE_SUBSCRIPTION
    )
  }

  return { deletedCount, blockedIds }
}

export async function updateStudentProfile(
  id: string,
  data: UpdateStudentData
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.programProfile.findUnique({
        where: { id },
        relationLoadStrategy: 'join',
        include: {
          person: true,
          enrollments: { orderBy: { startDate: 'desc' }, take: 1 },
        },
      })

      if (!profile)
        throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)

      const personUpdate: Prisma.PersonUpdateInput = {}
      if (data.name !== undefined) personUpdate.name = data.name
      if (data.dateOfBirth !== undefined)
        personUpdate.dateOfBirth = data.dateOfBirth
      if (data.email !== undefined) personUpdate.email = data.email
      if (data.phone !== undefined) personUpdate.phone = data.phone

      if (Object.keys(personUpdate).length > 0) {
        await tx.person.update({
          where: { id: profile.personId },
          data: personUpdate,
        })
      }

      const profileFields: Prisma.ProgramProfileUpdateInput = {
        ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
        ...(data.schoolName !== undefined && { schoolName: data.schoolName }),
        ...(data.graduationStatus !== undefined && {
          graduationStatus: data.graduationStatus,
        }),
        ...(data.paymentFrequency !== undefined && {
          paymentFrequency: data.paymentFrequency,
        }),
        ...(data.billingType !== undefined && {
          billingType: data.billingType,
        }),
        ...(data.paymentNotes !== undefined && {
          paymentNotes: data.paymentNotes,
        }),
      }

      if (Object.keys(profileFields).length > 0) {
        await tx.programProfile.update({ where: { id }, data: profileFields })
      }

      if (data.batchId !== undefined) {
        const latestEnrollment = profile.enrollments[0]
        if (latestEnrollment) {
          await tx.enrollment.update({
            where: { id: latestEnrollment.id },
            data: { batchId: data.batchId },
          })
        } else if (data.batchId) {
          await tx.enrollment.create({
            data: {
              programProfileId: id,
              batchId: data.batchId,
              status: 'REGISTERED',
              startDate: new Date(),
            },
          })
        }
      }
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    if (isPrismaError(error)) {
      if (error.code === 'P2002')
        throw new ActionError(
          'This email or phone is already associated with another student',
          ERROR_CODES.VALIDATION_ERROR
        )
      if (error.code === 'P2025')
        throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
      if (error.code === 'P2003')
        throw new ActionError(
          'Invalid batch or related record reference',
          ERROR_CODES.VALIDATION_ERROR
        )
    }
    throw error
  }
}
