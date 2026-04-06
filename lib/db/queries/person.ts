import { Prisma, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import {
  normalizePhone,
  validateAndNormalizeEmail,
} from '@/lib/utils/contact-normalization'

export type PersonContactFields = Pick<
  Prisma.PersonUpdateInput,
  'name' | 'email' | 'phone'
>

/**
 * Get people with multiple roles across the system
 * Useful for identifying staff/students/parents with multiple roles for policy decisions
 */
export async function getMultiRolePeople(
  filters?: {
    minRoles?: number
    hasTeacher?: boolean
    hasStudent?: boolean
    hasParent?: boolean
    program?: Program
  },
  client: DatabaseClient = prisma
) {
  const {
    minRoles = 2,
    hasTeacher,
    hasStudent,
    hasParent,
    program,
  } = filters || {}

  const where: Prisma.PersonWhereInput = {}

  if (hasTeacher) {
    where.teacher = { isNot: null }
  }

  if (hasStudent) {
    where.programProfiles = { some: {} }
  }

  if (hasParent) {
    where.guardianRelationships = { some: { isActive: true } }
  }

  const people = await client.person.findMany({
    where,
    relationLoadStrategy: 'join',
    include: {
      teacher: {
        include: {
          programs: {
            where: { isActive: true },
            select: { program: true },
          },
        },
      },
      programProfiles: {
        where: program ? { program } : {},
        include: {
          enrollments: {
            where: { status: { not: 'WITHDRAWN' }, endDate: null },
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
                select: { program: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Filter by role count
  return people.filter((person) => {
    let roleCount = 0
    if (person.teacher) roleCount++
    if (person.programProfiles.length > 0) roleCount++
    if (person.guardianRelationships.length > 0) roleCount++
    return roleCount >= minRoles
  })
}

export async function getPersonWithAllRelations(
  query: string,
  client: DatabaseClient = prisma
) {
  const searchTerm = query.trim().toLowerCase()
  const normalizedPhone = normalizePhone(query.trim())

  return client.person.findFirst({
    where: {
      OR: [
        { name: { equals: query.trim(), mode: 'insensitive' } },
        {
          email: {
            equals: validateAndNormalizeEmail(query.trim()) ?? searchTerm,
            mode: 'insensitive',
          },
        },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
    relationLoadStrategy: 'join',
    include: {
      teacher: {
        include: {
          programs: { where: { isActive: true } },
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
          dugsiClassEnrollment: {
            where: { isActive: true },
            include: {
              class: {
                include: {
                  teachers: {
                    where: { isActive: true },
                    include: { teacher: { include: { person: true } } },
                    take: 1,
                  },
                },
              },
            },
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
}

export async function updatePersonContact(
  personId: string,
  data: PersonContactFields,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.person.update({
    where: { id: personId },
    data,
  })
}
