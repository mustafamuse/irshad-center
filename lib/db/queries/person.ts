import { Prisma, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
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

/**
 * Verify that a person ID exists in the database.
 * Used to validate person IDs sourced from Stripe metadata before creating billing records.
 */
export async function findPersonById(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findUnique({
    where: { id: personId },
    select: { id: true },
  })
}

/**
 * Find a person via any billing account already linked to this Stripe customer ID.
 * Searches both Mahad and Dugsi customer ID columns — used for cross-program re-subscribers
 * where the program-specific billing account has not been created yet.
 */
export async function findPersonByStripeCustomerId(
  customerId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: {
      billingAccounts: {
        some: {
          OR: [
            { stripeCustomerIdMahad: customerId },
            { stripeCustomerIdDugsi: customerId },
          ],
        },
      },
    },
    select: { id: true },
  })
}

export async function updatePersonContact(
  personId: string,
  data: PersonContactFields,
  client: DatabaseClient = prisma
): Promise<void> {
  try {
    await client.person.update({
      where: { id: personId },
      data,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new ActionError(
          'Person not found',
          ERROR_CODES.NOT_FOUND,
          undefined,
          404
        )
      }
      if (error.code === 'P2002') {
        throw new ActionError(
          'This email or phone is already in use',
          ERROR_CODES.DUPLICATE_CONTACT
        )
      }
    }
    throw error
  }
}
