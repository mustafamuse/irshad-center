'use server'

import { revalidatePath } from 'next/cache'

import { Program } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { createServiceLogger, logError } from '@/lib/logger'
import { normalizePhone } from '@/lib/types/person'
import { ActionResult } from '@/lib/utils/action-helpers'

const logger = createServiceLogger('person-lookup')

export interface PersonLookupResult {
  id: string
  name: string
  contactPoints: Array<{
    id: string
    type: string
    value: string
    isPrimary: boolean
  }>
  roles: {
    teacher?: {
      id: string
      programs: Program[]
      studentCount: number
    }
    student?: {
      profiles: Array<{
        id: string
        program: Program
        status: string
        levelGroup?: string | null
        shift?: string | null
        teacherName?: string | null
      }>
    }
    parent?: {
      children: Array<{
        id: string
        name: string
        programs: Array<{
          program: Program
          status: string
        }>
      }>
    }
  }
  billingAccounts: Array<{
    id: string
    stripeCustomerId: string | null
    subscriptions: Array<{
      id: string
      status: string
      amount: number
      program: Program
    }>
  }>
  createdAt: Date
  updatedAt: Date
}

const deletePersonSchema = z.object({
  personId: z.string().uuid('Invalid person ID'),
})

export async function deletePersonAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = deletePersonSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }
  const { personId } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const teachers = await tx.teacher.findMany({
        where: { personId },
        select: { id: true },
      })
      const teacherIds = teachers.map((t) => t.id)

      const profiles = await tx.programProfile.findMany({
        where: { personId },
        select: { id: true },
      })
      const profileIds = profiles.map((p) => p.id)

      await tx.teacherAssignment.deleteMany({
        where: {
          OR: [
            { teacherId: { in: teacherIds } },
            { programProfileId: { in: profileIds } },
          ],
        },
      })

      await tx.teacherProgram.deleteMany({
        where: { teacherId: { in: teacherIds } },
      })

      await tx.teacher.deleteMany({
        where: { personId },
      })

      await tx.enrollment.deleteMany({
        where: { programProfileId: { in: profileIds } },
      })

      await tx.programProfile.deleteMany({
        where: { personId },
      })

      await tx.guardianRelationship.deleteMany({
        where: {
          OR: [{ guardianId: personId }, { dependentId: personId }],
        },
      })

      await tx.subscription.deleteMany({
        where: { billingAccount: { personId } },
      })

      await tx.billingAccount.deleteMany({
        where: { personId },
      })

      await tx.contactPoint.deleteMany({
        where: { personId },
      })

      await tx.person.delete({
        where: { id: personId },
      })
    })

    logger.info({ personId }, 'Person and all related records deleted entirely')

    revalidatePath('/admin/people/lookup')
    revalidatePath('/admin/people')
    revalidatePath('/admin/teachers')
    revalidatePath('/admin/dugsi')
    revalidatePath('/admin/mahad')

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to delete person', { personId })
    return {
      success: false,
      error:
        'Failed to delete person. They may have dependencies that need to be removed first.',
    }
  }
}

export async function lookupPersonAction(
  query: string
): Promise<ActionResult<PersonLookupResult | null>> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: null }
    }

    const searchTerm = query.trim().toLowerCase()
    const normalizedPhone = normalizePhone(query.trim())

    const person = await prisma.person.findFirst({
      where: {
        OR: [
          { name: { equals: query.trim(), mode: 'insensitive' } },
          {
            contactPoints: {
              some: {
                OR: [
                  {
                    type: 'EMAIL',
                    value: { equals: searchTerm, mode: 'insensitive' },
                  },
                  ...(normalizedPhone
                    ? [
                        {
                          type: {
                            in: ['PHONE', 'WHATSAPP'] as (
                              | 'PHONE'
                              | 'WHATSAPP'
                            )[],
                          },
                          value: normalizedPhone,
                        },
                      ]
                    : []),
                ],
              },
            },
          },
        ],
      },
      include: {
        contactPoints: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        teacher: {
          include: {
            programs: {
              where: { isActive: true },
            },
          },
        },
        programProfiles: {
          include: {
            enrollments: {
              where: {
                status: { in: ['REGISTERED', 'ENROLLED'] },
                endDate: null,
              },
              orderBy: { startDate: 'desc' },
              take: 1,
            },
            teacherAssignments: {
              where: { isActive: true },
              include: {
                teacher: {
                  include: {
                    person: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
        guardianRelationships: {
          where: { isActive: true },
          include: {
            dependent: {
              include: {
                programProfiles: {
                  include: {
                    enrollments: {
                      where: {
                        status: { in: ['REGISTERED', 'ENROLLED'] },
                        endDate: null,
                      },
                      orderBy: { startDate: 'desc' },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        billingAccounts: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing', 'past_due'] } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!person) {
      return { success: true, data: null }
    }

    const result: PersonLookupResult = {
      id: person.id,
      name: person.name,
      contactPoints: person.contactPoints.map((cp) => ({
        id: cp.id,
        type: cp.type,
        value: cp.value,
        isPrimary: cp.isPrimary,
      })),
      roles: {},
      billingAccounts: person.billingAccounts.map((ba) => ({
        id: ba.id,
        stripeCustomerId: ba.stripeCustomerIdMahad || ba.stripeCustomerIdDugsi,
        subscriptions: ba.subscriptions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          amount: sub.amount,
          program:
            sub.stripeAccountType === 'DUGSI'
              ? 'DUGSI_PROGRAM'
              : 'MAHAD_PROGRAM',
        })),
      })),
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    }

    if (person.teacher) {
      const studentCount = await prisma.teacherAssignment.count({
        where: {
          teacherId: person.teacher.id,
          isActive: true,
        },
      })

      result.roles.teacher = {
        id: person.teacher.id,
        programs: person.teacher.programs.map((p) => p.program),
        studentCount,
      }
    }

    if (person.programProfiles.length > 0) {
      result.roles.student = {
        profiles: person.programProfiles.map((profile) => ({
          id: profile.id,
          program: profile.program,
          status: profile.enrollments[0]?.status || 'REGISTERED',
          levelGroup: profile.gradeLevel ?? null,
          shift: profile.shift ?? null,
          teacherName: profile.teacherAssignments[0]?.teacher.person.name,
        })),
      }
    }

    if (person.guardianRelationships.length > 0) {
      result.roles.parent = {
        children: person.guardianRelationships.map((rel) => ({
          id: rel.dependent.id,
          name: rel.dependent.name,
          programs: rel.dependent.programProfiles.map((profile) => ({
            program: profile.program,
            status: profile.enrollments[0]?.status || 'REGISTERED',
          })),
        })),
      }
    }

    logger.info({ personId: person.id, query }, 'Person lookup successful')

    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Failed to lookup person', { query })
    return {
      success: false,
      error: 'Failed to lookup person',
    }
  }
}
