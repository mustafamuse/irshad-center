import { Prisma, Program, StripeAccountType } from '@prisma/client'

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
 * Get a person by ID. Used to verify webhook metadata person IDs against the
 * database before acting on them — Stripe metadata is a hint, not authority.
 */
export async function getPersonById(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findUnique({ where: { id: personId } })
}

/**
 * Find the person who owns a billing account carrying the given Stripe
 * customer ID in the given program's column. Scoped per program - customer
 * IDs are namespaced per Stripe account, and a cross-column match would
 * write the ID into the wrong program's column downstream.
 */
export async function findPersonByBillingCustomerId(
  stripeCustomerId: string,
  accountType: StripeAccountType,
  client: DatabaseClient = prisma
) {
  if (accountType !== 'MAHAD' && accountType !== 'DUGSI') return null
  return client.person.findFirst({
    where: {
      billingAccounts: {
        some:
          accountType === 'MAHAD'
            ? { stripeCustomerIdMahad: stripeCustomerId }
            : { stripeCustomerIdDugsi: stripeCustomerId },
      },
    },
  })
}

/**
 * Find a person by exact email match.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByEmail(
  email: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({ where: { email } })
}

/**
 * Find a person by exact email match (unique lookup). Used for P2002
 * race-condition recovery when creating a guardian Person.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByEmailUnique(
  email: string,
  client: DatabaseClient = prisma
) {
  return client.person.findUnique({ where: { email } })
}

/**
 * Find a person by exact email match, including their program profiles.
 * Used to validate guardian email uniqueness.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByEmailWithProfiles(
  email: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    relationLoadStrategy: 'join',
    where: { email },
    include: {
      programProfiles: true,
    },
  })
}

/**
 * Find a person by exact email match, including their active dependent
 * relationships and each dependent's program profiles. Used to look up a
 * guardian and their children by email.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByEmailWithActiveDependents(
  email: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    relationLoadStrategy: 'join',
    where: { email },
    include: {
      dependentRelationships: {
        where: { isActive: true },
        include: {
          dependent: {
            include: {
              programProfiles: true,
            },
          },
        },
      },
    },
  })
}

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
 * Create a Person record with the given contact fields.
 * @param client - Optional database client (for transaction support)
 */
export async function createPerson(
  data: {
    name: string
    dateOfBirth?: Date | null
    email?: string | null
    phone?: string | null
  },
  client: DatabaseClient = prisma
) {
  return client.person.create({ data })
}

/**
 * Create a Person record, returning only id/name/email/phone.
 * @param client - Optional database client (for transaction support)
 */
export async function createPersonMinimal(
  data: {
    name: string
    dateOfBirth?: Date | null
    email?: string | null
    phone?: string | null
  },
  client: DatabaseClient = prisma
) {
  return client.person.create({
    data,
    select: { id: true, name: true, email: true, phone: true },
  })
}

/**
 * Update arbitrary Person fields, returning the full record.
 * @param client - Optional database client (for transaction support)
 */
export async function updatePersonFields(
  personId: string,
  data: Prisma.PersonUpdateInput,
  client: DatabaseClient = prisma
) {
  return client.person.update({ where: { id: personId }, data })
}

/**
 * Update arbitrary Person fields, returning only id/name/email/phone.
 * @param client - Optional database client (for transaction support)
 */
export async function updatePersonFieldsMinimal(
  personId: string,
  data: Prisma.PersonUpdateInput,
  client: DatabaseClient = prisma
) {
  return client.person.update({
    where: { id: personId },
    data,
    select: { id: true, name: true, email: true, phone: true },
  })
}

/**
 * Get a Person by ID, throwing if not found.
 * @param client - Optional database client (for transaction support)
 */
export async function getPersonByIdOrThrow(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findUniqueOrThrow({ where: { id: personId } })
}

/**
 * Find a Person by case-insensitive name and exact date of birth.
 * Used for P2002 race-condition recovery during batch child creation.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByNameAndDob(
  name: string,
  dateOfBirth: Date | null | undefined,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      dateOfBirth: { equals: dateOfBirth },
    },
    select: { id: true, name: true },
  })
}

/**
 * Find Persons matching a caller-built where clause, returning
 * id/name/dateOfBirth. Used for batched name+DOB lookups.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonsByConditions(
  where: Prisma.PersonWhereInput,
  client: DatabaseClient = prisma
) {
  return client.person.findMany({
    where,
    select: { id: true, name: true, dateOfBirth: true },
  })
}

/**
 * Get a person with active guardian and dependent relationships, each
 * including the related person. Used for sibling detection via shared
 * guardians.
 * @param client - Optional database client (for transaction support)
 */
export async function getPersonWithActiveRelationships(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findUnique({
    relationLoadStrategy: 'join',
    where: { id: personId },
    include: {
      guardianRelationships: {
        where: { isActive: true },
        include: {
          guardian: true,
        },
      },
      dependentRelationships: {
        where: { isActive: true },
        include: {
          dependent: true,
        },
      },
    },
  })
}

/**
 * Find persons whose name contains the given substring (case-insensitive),
 * excluding one person. Used for last-name sibling matching.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonsByLastNameMatch(
  lastName: string,
  excludePersonId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findMany({
    where: {
      id: { not: excludePersonId },
      name: {
        contains: lastName,
        mode: 'insensitive',
      },
    },
  })
}

/**
 * Find persons matching any of the given contact conditions (email/phone),
 * excluding one person. Used for contact-based sibling matching.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonsByContactConditions(
  orConditions: Prisma.PersonWhereInput[],
  excludePersonId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findMany({
    where: {
      id: { not: excludePersonId },
      OR: orConditions,
    },
  })
}

/**
 * Find a person owning the given email, excluding one person. Used to check
 * ownership before writing an email onto an invited Mahad profile.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByEmailExcluding(
  email: string,
  excludePersonId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: {
      email,
      NOT: { id: excludePersonId },
    },
    select: { id: true },
  })
}

/**
 * Find a person owning the given phone, excluding one person. Used to check
 * ownership before writing a phone onto an invited Mahad profile.
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByPhoneExcluding(
  phone: string,
  excludePersonId: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: {
      phone,
      NOT: { id: excludePersonId },
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
