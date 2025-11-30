/**
 * Program Profile Query Functions
 *
 * Query functions for the new unified identity model (Person → ProgramProfile → Enrollment).
 * These functions work alongside legacy Student queries during migration.
 */

import {
  Prisma,
  Program,
  EnrollmentStatus,
  ContactType,
  GradeLevel,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { normalizePhone } from '@/lib/types/person'

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

  // Search across person name and contact points
  if (search && search.trim()) {
    const searchTerm = search.trim()
    where.person = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          contactPoints: {
            some: {
              OR: [
                {
                  type: 'EMAIL',
                  value: { contains: searchTerm, mode: 'insensitive' },
                },
                {
                  type: 'PHONE',
                  value: { contains: normalizePhone(searchTerm) || '' },
                },
              ],
            },
          },
        },
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
    include: {
      person: {
        include: {
          contactPoints: true,
          dependentRelationships: {
            where: { isActive: true },
            include: {
              guardian: {
                include: {
                  contactPoints: true,
                },
              },
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
              billingAccount: {
                include: {
                  person: true,
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
 * Find person by email or phone
 *
 * @param email - Email address to search for
 * @param phone - Phone number to search for
 * @param client - Optional database client (for transaction support)
 */
export async function findPersonByContact(
  email?: string | null,
  phone?: string | null,
  client: DatabaseClient = prisma
) {
  if (!email && !phone) return null

  const where: Prisma.PersonWhereInput = {
    OR: [],
  }

  if (email) {
    where.OR!.push({
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: email.toLowerCase().trim(),
        },
      },
    })
  }

  if (phone) {
    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone) {
      where.OR!.push({
        contactPoints: {
          some: {
            type: { in: ['PHONE', 'WHATSAPP'] },
            value: normalizedPhone,
          },
        },
      })
    }
  }

  return client.person.findFirst({
    where,
    include: {
      contactPoints: true,
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
 * Create a new program profile
 * @param client - Optional database client (for transaction support)
 */
export async function createProgramProfile(
  data: {
    personId: string
    program: Program
    status?: EnrollmentStatus
    gradeLevel?: GradeLevel | null
    schoolName?: string | null
    familyReferenceId?: string | null
  },
  client: DatabaseClient = prisma
) {
  return client.programProfile.create({
    data: {
      personId: data.personId,
      program: data.program,
      status: data.status || 'REGISTERED',
      gradeLevel: data.gradeLevel,
      schoolName: data.schoolName,
      familyReferenceId: data.familyReferenceId,
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      enrollments: true,
    },
  })
}

/**
 * Get enrollments for a batch
 * @param client - Optional database client (for transaction support)
 */
export async function getEnrollmentsByBatch(
  batchId: string,
  status?: EnrollmentStatus,
  client: DatabaseClient = prisma
) {
  return client.enrollment.findMany({
    where: {
      batchId,
      status: status || { not: 'WITHDRAWN' },
      endDate: null,
    },
    include: {
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

// Note: getActiveEnrollment moved to enrollment.ts to avoid duplication
// Import from '@/lib/db/queries/enrollment' if needed

/**
 * Create a new enrollment
 * @param client - Optional database client (for transaction support)
 */
export async function createEnrollment(
  data: {
    programProfileId: string
    batchId?: string | null
    status?: EnrollmentStatus
    startDate?: Date
    reason?: string | null
    notes?: string | null
  },
  client: DatabaseClient = prisma
) {
  return client.enrollment.create({
    data: {
      programProfileId: data.programProfileId,
      batchId: data.batchId,
      status: data.status || 'REGISTERED',
      startDate: data.startDate || new Date(),
      reason: data.reason,
      notes: data.notes,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
  })
}

/**
 * Update enrollment status (e.g., withdraw, re-enroll)
 * @param client - Optional database client (for transaction support)
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
  reason?: string | null,
  endDate?: Date | null,
  client: DatabaseClient = prisma
) {
  return client.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      endDate: endDate || (status === 'WITHDRAWN' ? new Date() : null),
      reason,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
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
    include: {
      person: {
        include: {
          contactPoints: true,
          dependentRelationships: {
            include: {
              guardian: {
                include: {
                  contactPoints: true,
                },
              },
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
              amount: true,
              stripeCustomerId: true,
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
                  person: {
                    include: {
                      contactPoints: true,
                    },
                  },
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
        {
          contactPoints: {
            some: {
              OR: [
                {
                  type: 'EMAIL',
                  value: { contains: normalizedSearch, mode: 'insensitive' },
                },
                ...(normalizedPhone
                  ? [
                      {
                        type: { in: ['PHONE', 'WHATSAPP'] as ContactType[] },
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
  }

  if (program) {
    where.program = program
  }

  return client.programProfile.findMany({
    where,
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
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
    },
    take: 50, // Limit results
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
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
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
