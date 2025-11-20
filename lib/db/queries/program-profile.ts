/**
 * Program Profile Query Functions
 *
 * Query functions for the new unified identity model (Person → ProgramProfile → Enrollment).
 * These functions work alongside legacy Student queries during migration.
 */

import { Prisma, Program, EnrollmentStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/types/person'

/**
 * Get program profiles with related data
 */
export async function getProgramProfiles(params: {
  program?: Program
  status?: EnrollmentStatus
  batchId?: string | null
  includeUnassigned?: boolean
  search?: string
  page?: number
  limit?: number
}) {
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
    prisma.programProfile.findMany({
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
    prisma.programProfile.count({ where }),
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
 */
export async function getProgramProfileById(profileId: string) {
  return prisma.programProfile.findUnique({
    where: { id: profileId },
    include: {
      person: {
        include: {
          contactPoints: true,
          guardianRelationships: {
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
 */
export async function getProgramProfilesByPersonId(personId: string) {
  return prisma.programProfile.findMany({
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
 */
export async function findPersonByContact(
  email?: string | null,
  phone?: string | null
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

  return prisma.person.findFirst({
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
 * Get enrollments for a batch
 */
export async function getEnrollmentsByBatch(
  batchId: string,
  status?: EnrollmentStatus
) {
  return prisma.enrollment.findMany({
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

/**
 * Get active enrollments for a program profile
 */
export async function getActiveEnrollment(programProfileId: string) {
  return prisma.enrollment.findFirst({
    where: {
      programProfileId,
      status: 'ENROLLED',
      endDate: null,
    },
    include: {
      batch: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Create a new enrollment
 */
export async function createEnrollment(data: {
  programProfileId: string
  batchId?: string | null
  status?: EnrollmentStatus
  startDate?: Date
  reason?: string | null
  notes?: string | null
}) {
  return prisma.enrollment.create({
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
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
  reason?: string | null,
  endDate?: Date | null
) {
  return prisma.enrollment.update({
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
