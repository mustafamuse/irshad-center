/**
 * Program Profile Query Functions
 *
 * Query functions for the new unified identity model (Person → ProgramProfile → Enrollment).
 * These functions work alongside legacy Student queries during migration.
 */

import { Prisma, Program, EnrollmentStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import {
  normalizeEmail,
  normalizePhone,
  validateAndNormalizeEmail,
} from '@/lib/utils/contact-normalization'

/**
 * Get program profiles with related data
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfiles(
  params: {
    program?: Program
    status?: EnrollmentStatus
    batchId?: string | null
    includeUnassigned?: boolean
    search?: string
    page?: number
    limit?: number
  },
  client: DatabaseClient = prisma
) {
  const {
    program,
    status,
    batchId,
    includeUnassigned = true,
    search,
    page = 1,
    limit = 50,
  } = params

  const skip = (page - 1) * limit

  const where: Prisma.ProgramProfileWhereInput = {}

  if (program) {
    where.program = program
  }

  if (status) {
    where.status = status
  }

  if (search && search.trim()) {
    const searchTerm = search.trim()
    const normalizedPhone = normalizePhone(searchTerm)
    where.person = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          email: {
            contains: validateAndNormalizeEmail(searchTerm) ?? searchTerm,
            mode: 'insensitive',
          },
        },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    }
  }

  // Batch filter via enrollments
  if (batchId !== undefined) {
    const enrollmentWhere: Prisma.EnrollmentWhereInput = {
      OR: includeUnassigned
        ? [{ batchId: batchId }, { batchId: null }]
        : [{ batchId: batchId }],
      status: { not: 'WITHDRAWN' },
      endDate: null, // Active enrollment
    }

    where.enrollments = {
      some: enrollmentWhere,
    }
  }

  const [profiles, total] = await Promise.all([
    client.programProfile.findMany({
      where,
      relationLoadStrategy: 'join',
      include: {
        person: true,
        enrollments: {
          where: {
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
          include: {
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            startDate: 'desc',
          },
          take: 1, // Get most recent active enrollment
        },
        assignments: {
          where: {
            isActive: true,
          },
          include: {
            subscription: {
              select: {
                id: true,
                stripeSubscriptionId: true,
                status: true,
                amount: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    client.programProfile.count({ where }),
  ])

  return {
    profiles,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Get a single program profile by ID
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfileById(
  profileId: string,
  client: DatabaseClient = prisma
) {
  return client.programProfile.findUnique({
    where: { id: profileId },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          dependentRelationships: {
            where: { isActive: true },
            include: {
              guardian: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          batch: true,
        },
        orderBy: {
          startDate: 'desc',
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: {
            include: {
              billingAccount: true,
            },
          },
        },
      },
      dugsiClassEnrollment: {
        include: {
          class: {
            include: {
              teachers: {
                where: { isActive: true },
                include: {
                  teacher: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * Get program profiles by person ID
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfilesByPersonId(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.programProfile.findMany({
    where: { personId },
    relationLoadStrategy: 'join',
    include: {
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
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Find person by active email or phone (excludes soft-deleted contacts)
 */
export async function findPersonByActiveContact(
  email?: string | null,
  phone?: string | null,
  client: DatabaseClient = prisma
) {
  const normalizedEmail = email ? normalizeEmail(email) : null
  const normalizedPhone = phone ? normalizePhone(phone) : null
  if (!normalizedEmail && !normalizedPhone) return null

  const orConditions: Prisma.PersonWhereInput[] = []
  if (normalizedEmail) orConditions.push({ email: normalizedEmail })
  if (normalizedPhone) orConditions.push({ phone: normalizedPhone })

  return client.person.findFirst({
    where: { OR: orConditions },
    relationLoadStrategy: 'join',
    include: {
      programProfiles: {
        include: {
          enrollments: {
            where: {
              status: { not: 'WITHDRAWN' },
              endDate: null,
            },
          },
        },
      },
    },
  })
}

/**
 * Get program profiles by family reference ID (Dugsi families)
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfilesByFamilyId(
  familyId: string,
  client: DatabaseClient = prisma
) {
  return client.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: 'DUGSI_PROGRAM',
    },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          dependentRelationships: {
            include: {
              guardian: true,
            },
          },
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
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: {
            select: {
              id: true,
              stripeSubscriptionId: true,
              status: true,
            },
          },
        },
      },
      dugsiClassEnrollment: {
        include: {
          class: {
            include: {
              teachers: {
                where: { isActive: true },
                include: {
                  teacher: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
}

/**
 * Get program profiles with billing information
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfilesWithBilling(
  params: {
    program?: Program
    status?: EnrollmentStatus
    includeInactive?: boolean
    // Filtering
    studentName?: string
    batchId?: string
    needsBilling?: boolean
    excludeTestBatch?: boolean
    // Pagination
    skip?: number
    take?: number
    // Sorting
    orderBy?: {
      column: 'name' | 'createdAt' | 'status'
      order: 'asc' | 'desc'
    }
  },
  client: DatabaseClient = prisma
) {
  const {
    program,
    status,
    includeInactive = false,
    studentName,
    batchId,
    needsBilling,
    excludeTestBatch = true,
    skip,
    take,
    orderBy = { column: 'createdAt', order: 'desc' },
  } = params

  const where: Prisma.ProgramProfileWhereInput = {}

  if (program) {
    where.program = program
  }

  if (status) {
    where.status = status
  }

  // Filter by student name
  if (studentName) {
    where.person = {
      name: { contains: studentName, mode: 'insensitive' },
    }
  }

  // Filter by batch
  if (batchId) {
    where.enrollments = {
      some: {
        batchId,
        status: { not: 'WITHDRAWN' },
        endDate: null,
      },
    }
  }

  // Filter by needs billing (no active subscription)
  if (needsBilling) {
    where.status = { not: 'WITHDRAWN' }
    where.assignments = {
      none: {
        isActive: true,
        subscription: {
          status: 'active',
        },
      },
    }
  }

  // Exclude Test batch
  if (excludeTestBatch) {
    where.enrollments = {
      ...where.enrollments,
      none: {
        batch: {
          name: 'Test',
        },
      },
    }
  }

  // Build orderBy clause
  let orderByClause: Prisma.ProgramProfileOrderByWithRelationInput
  switch (orderBy.column) {
    case 'name':
      orderByClause = {
        person: {
          name: orderBy.order,
        },
      }
      break
    case 'status':
      orderByClause = {
        status: orderBy.order,
      }
      break
    case 'createdAt':
    default:
      orderByClause = {
        createdAt: orderBy.order,
      }
      break
  }

  return client.programProfile.findMany({
    where,
    relationLoadStrategy: 'join',
    include: {
      person: true,
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        include: {
          batch: true,
        },
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
      assignments: {
        where: includeInactive ? undefined : { isActive: true },
        include: {
          subscription: {
            include: {
              billingAccount: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      },
      payments: true,
    },
    orderBy: orderByClause,
    skip,
    take,
  })
}

/**
 * Get total count of program profiles matching filters (for pagination)
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfilesWithBillingCount(
  params: {
    program?: Program
    status?: EnrollmentStatus
    studentName?: string
    batchId?: string
    needsBilling?: boolean
    excludeTestBatch?: boolean
  },
  client: DatabaseClient = prisma
) {
  const {
    program,
    status,
    studentName,
    batchId,
    needsBilling,
    excludeTestBatch = true,
  } = params

  const where: Prisma.ProgramProfileWhereInput = {}

  if (program) {
    where.program = program
  }

  if (status) {
    where.status = status
  }

  if (studentName) {
    where.person = {
      name: { contains: studentName, mode: 'insensitive' },
    }
  }

  if (batchId) {
    where.enrollments = {
      some: {
        batchId,
        status: { not: 'WITHDRAWN' },
        endDate: null,
      },
    }
  }

  if (needsBilling) {
    where.status = { not: 'WITHDRAWN' }
    where.assignments = {
      none: {
        isActive: true,
        subscription: {
          status: 'active',
        },
      },
    }
  }

  if (excludeTestBatch) {
    where.enrollments = {
      ...where.enrollments,
      none: {
        batch: {
          name: 'Test',
        },
      },
    }
  }

  return client.programProfile.count({ where })
}

/**
 * Search program profiles by name or contact information
 * @param client - Optional database client (for transaction support)
 */
export async function searchProgramProfilesByNameOrContact(
  searchTerm: string,
  program?: Program,
  client: DatabaseClient = prisma
) {
  const normalizedSearch = searchTerm.trim()
  if (!normalizedSearch) return []

  const normalizedPhone = normalizePhone(normalizedSearch)

  const where: Prisma.ProgramProfileWhereInput = {
    person: {
      OR: [
        { name: { contains: normalizedSearch, mode: 'insensitive' } },
        { email: { contains: normalizedSearch, mode: 'insensitive' } },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
  }

  if (program) {
    where.program = program
  }

  return client.programProfile.findMany({
    where,
    relationLoadStrategy: 'join',
    include: {
      person: true,
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        include: {
          batch: true,
        },
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
    },
    take: 50,
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
 * Update shift for all program profiles in a family
 * @param client - Optional database client (for transaction support)
 */
export async function updateFamilyShift(
  familyReferenceId: string,
  shift: 'MORNING' | 'AFTERNOON',
  program: Program,
  client: DatabaseClient = prisma
) {
  return client.programProfile.updateMany({
    where: {
      program,
      familyReferenceId,
    },
    data: {
      shift,
    },
  })
}

/**
 * Get program profiles by status with proper enrollment filtering
 * @param client - Optional database client (for transaction support)
 */
export async function getProgramProfilesByStatus(
  status: EnrollmentStatus,
  program?: Program,
  client: DatabaseClient = prisma
) {
  const where: Prisma.ProgramProfileWhereInput = {
    status,
    enrollments: {
      some: {
        status,
        endDate: null, // Active enrollment
      },
    },
  }

  if (program) {
    where.program = program
  }

  return client.programProfile.findMany({
    where,
    relationLoadStrategy: 'join',
    include: {
      person: true,
      enrollments: {
        where: {
          status,
          endDate: null,
        },
        include: {
          batch: true,
        },
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: {
            select: {
              id: true,
              stripeSubscriptionId: true,
              status: true,
              amount: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
