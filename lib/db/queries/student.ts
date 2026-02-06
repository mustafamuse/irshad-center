/**
 * Student Query Functions (Migrated to ProgramProfile/Enrollment Model)
 *
 * These functions provide a "Student" view of the unified Person → ProgramProfile → Enrollment
 * architecture. They're specifically for Mahad students and maintain backward compatibility
 * with the legacy Student model interface while using the new data structure underneath.
 *
 * Migration Status: ✅ COMPLETE
 * - All functions migrated from legacy Student model
 * - Uses ProgramProfile + Enrollment for data access
 * - Maintains backward-compatible return types for UI components
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
  EnrollmentStatus,
  Prisma,
  SubscriptionStatus,
  ContactType,
} from '@prisma/client'
import { findDuplicateStudents as findDuplicateStudentsSql } from '@prisma/client/sql'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { normalizePhone } from '@/lib/types/person'
import { StudentStatus } from '@/lib/types/student'
import { isPrismaError } from '@/lib/utils/type-guards'

export interface MahadStudent {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: Date | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null
  status: StudentStatus
  batchId: string | null
  createdAt: Date
  updatedAt: Date
  batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
  subscription: {
    id: string
    status: string
    stripeSubscriptionId: string | null
    amount: number
  } | null
  siblingCount?: number
}

/**
 * Helper: Convert EnrollmentStatus (uppercase) to StudentStatus (lowercase)
 */
function enrollmentStatusToStudentStatus(
  enrollmentStatus: EnrollmentStatus
): StudentStatus {
  const mapping: Record<EnrollmentStatus, StudentStatus> = {
    REGISTERED: StudentStatus.REGISTERED,
    ENROLLED: StudentStatus.ENROLLED,
    ON_LEAVE: StudentStatus.ON_LEAVE,
    WITHDRAWN: StudentStatus.WITHDRAWN,
    // Legacy statuses that don't exist in StudentStatus - map to closest equivalent
    COMPLETED: StudentStatus.WITHDRAWN,
    SUSPENDED: StudentStatus.WITHDRAWN,
  }
  return mapping[enrollmentStatus]
}

/**
 * Helper: Convert StudentStatus (lowercase) to EnrollmentStatus (uppercase)
 */
function studentStatusToEnrollmentStatus(
  studentStatus: StudentStatus
): EnrollmentStatus {
  const mapping: Record<StudentStatus, EnrollmentStatus> = {
    [StudentStatus.REGISTERED]: 'REGISTERED',
    [StudentStatus.ENROLLED]: 'ENROLLED',
    [StudentStatus.ON_LEAVE]: 'ON_LEAVE',
    [StudentStatus.WITHDRAWN]: 'WITHDRAWN',
  }
  return mapping[studentStatus]
}

/**
 * Helper: Transform ProgramProfile to MahadStudent
 */
type ProfileWithRelations = Prisma.ProgramProfileGetPayload<{
  include: {
    person: {
      include: {
        contactPoints: true
      }
    }
    enrollments: {
      include: {
        batch: true
      }
    }
    assignments: {
      include: {
        subscription: true
      }
    }
  }
}>

function transformToStudent(profile: ProfileWithRelations): MahadStudent {
  // Extract primary contact points
  const emailContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )
  const phoneContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )

  // Get the most recent active enrollment
  const enrollment = profile.enrollments?.[0]

  // Get active subscription
  const activeAssignment = profile.assignments?.[0]
  const subscription = activeAssignment?.subscription

  return {
    id: profile.id,
    name: profile.person.name,
    email: emailContact?.value || null,
    phone: phoneContact?.value || null,
    dateOfBirth: profile.person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    // Mahad billing fields
    graduationStatus: profile.graduationStatus,
    paymentFrequency: profile.paymentFrequency,
    billingType: profile.billingType,
    paymentNotes: profile.paymentNotes,
    status: enrollment
      ? enrollmentStatusToStudentStatus(enrollment.status)
      : StudentStatus.REGISTERED,
    batchId: enrollment?.batchId || null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    batch: enrollment?.batch
      ? {
          id: enrollment.batch.id,
          name: enrollment.batch.name,
          startDate: enrollment.batch.startDate,
          endDate: enrollment.batch.endDate,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          amount: subscription.amount,
        }
      : null,
    siblingCount: 0, // Will be populated separately if needed
  }
}

/**
 * Get all students with basic information (Mahad only)
 */
export async function getStudents(client: DatabaseClient = prisma) {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
    },
    relationLoadStrategy: 'join',
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
        where: { isActive: true },
        include: {
          subscription: true,
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return profiles.map(transformToStudent)
}

/**
 * Get all students with batch and sibling information (excluding withdrawn)
 */
export async function getStudentsWithBatch(client: DatabaseClient = prisma) {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      enrollments: {
        some: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
      },
    },
    relationLoadStrategy: 'join',
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
        where: { isActive: true },
        include: {
          subscription: true,
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return profiles.map(transformToStudent)
}

/**
 * Get students with batch info, filtering, and pagination
 * This is the primary function used by the admin interface
 */
export async function getStudentsWithBatchFiltered(
  params: {
    page?: number
    limit?: number
    search?: string
    batchIds?: string[]
    includeUnassigned?: boolean
    statuses?: string[] // StudentStatus values
    subscriptionStatuses?: string[] // SubscriptionStatus values
    gradeLevels?: GradeLevel[]
    graduationStatuses?: GraduationStatus[]
    billingTypes?: StudentBillingType[]
  },
  client: DatabaseClient = prisma
) {
  const {
    page = 1,
    limit = 50,
    search,
    batchIds = [],
    includeUnassigned = true,
    statuses = [],
    subscriptionStatuses = [],
    gradeLevels = [],
    graduationStatuses = [],
    billingTypes = [],
  } = params

  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.ProgramProfileWhereInput = {
    program: 'MAHAD_PROGRAM',
  }

  // Search across person name and contact points
  if (search && search.trim()) {
    const searchTerm = search.trim()
    const normalizedPhone = normalizePhone(searchTerm)

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
    }
  }

  // Filter by batch IDs
  if (batchIds.length > 0) {
    const batchConditions: Prisma.EnrollmentWhereInput[] = batchIds.map(
      (batchId) => ({
        batchId,
        status: { not: 'WITHDRAWN' },
        endDate: null,
      })
    )

    if (includeUnassigned) {
      batchConditions.push({
        batchId: null,
        status: { not: 'WITHDRAWN' },
        endDate: null,
      })
    }

    where.enrollments = {
      some: {
        OR: batchConditions,
      },
    }
  }

  // Filter by enrollment status (convert StudentStatus to EnrollmentStatus)
  if (statuses.length > 0) {
    const enrollmentStatuses = statuses.map((status) =>
      studentStatusToEnrollmentStatus(status as StudentStatus)
    )

    // Type-safe merge of enrollment conditions
    const existingSome =
      where.enrollments && 'some' in where.enrollments
        ? where.enrollments.some
        : {}

    where.enrollments = {
      ...where.enrollments,
      some: {
        ...(typeof existingSome === 'object' ? existingSome : {}),
        status: { in: enrollmentStatuses },
        endDate: null,
      },
    }
  }

  // Filter by subscription status
  if (subscriptionStatuses.length > 0) {
    where.assignments = {
      some: {
        isActive: true,
        subscription: {
          status: { in: subscriptionStatuses as SubscriptionStatus[] },
        },
      },
    }
  }

  // Filter by grade level
  if (gradeLevels.length > 0) {
    where.gradeLevel = { in: gradeLevels }
  }

  // Filter by graduation status
  if (graduationStatuses.length > 0) {
    where.graduationStatus = { in: graduationStatuses }
  }

  // Filter by billing type
  if (billingTypes.length > 0) {
    where.billingType = { in: billingTypes }
  }

  // Execute queries in parallel
  const [profiles, totalCount] = await Promise.all([
    client.programProfile.findMany({
      where,
      relationLoadStrategy: 'join',
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
          where: { isActive: true },
          include: {
            subscription: true,
          },
          take: 1,
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

  const students = profiles.map(transformToStudent)

  return {
    students,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  }
}

/**
 * Get a single student by ID
 */
export async function getStudentById(
  id: string,
  client: DatabaseClient = prisma
) {
  const profile = await client.programProfile.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          contactPoints: true,
          siblingRelationships1: {
            where: { isActive: true },
          },
          siblingRelationships2: {
            where: { isActive: true },
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
      payments: {
        orderBy: {
          paidAt: 'desc',
        },
        take: 10,
      },
    },
  })

  if (!profile) return null

  return transformToStudent(profile)
}

/**
 * Get a student by email (case-insensitive)
 */
export async function getStudentByEmail(
  email: string,
  client: DatabaseClient = prisma
) {
  const profile = await client.programProfile.findFirst({
    where: {
      program: 'MAHAD_PROGRAM',
      person: {
        contactPoints: {
          some: {
            type: 'EMAIL',
            value: email.toLowerCase().trim(),
          },
        },
      },
    },
    relationLoadStrategy: 'join',
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
        where: { isActive: true },
        include: {
          subscription: true,
        },
        take: 1,
      },
    },
  })

  if (!profile) return null

  return transformToStudent(profile)
}

/**
 * Get students by batch ID
 */
export async function getStudentsByBatch(
  batchId: string,
  client: DatabaseClient = prisma
) {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      enrollments: {
        some: {
          batchId,
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
      },
    },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      enrollments: {
        where: {
          batchId,
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
          subscription: true,
        },
        take: 1,
      },
    },
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })

  return profiles.map(transformToStudent)
}

/**
 * Get unassigned students (no batch)
 */
export async function getUnassignedStudents(client: DatabaseClient = prisma) {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      OR: [
        // No enrollments at all
        {
          enrollments: {
            none: {},
          },
        },
        // Has enrollments but none with batchId
        {
          enrollments: {
            every: {
              OR: [{ batchId: null }, { status: 'WITHDRAWN' }],
            },
          },
        },
      ],
    },
    relationLoadStrategy: 'join',
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
        where: { isActive: true },
        include: {
          subscription: true,
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return profiles.map(transformToStudent)
}

/**
 * Search students with filters and pagination
 */
export async function searchStudents(
  query?: string,
  filters?: {
    search?: {
      query?: string
      fields?: ('name' | 'email' | 'phone')[]
    }
    batch?: {
      selected?: string[]
      includeUnassigned?: boolean
    }
    status?: {
      selected?: string[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
    }
    graduationStatus?: {
      selected?: GraduationStatus[]
    }
    billingType?: {
      selected?: StudentBillingType[]
    }
    dateRange?: {
      from?: Date
      to?: Date
      field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
    }
  },
  pagination?: {
    page: number
    pageSize: number
  },
  client: DatabaseClient = prisma
) {
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50

  const result = await getStudentsWithBatchFiltered(
    {
      page,
      limit: pageSize,
      search: filters?.search?.query || query,
      batchIds: filters?.batch?.selected,
      includeUnassigned: filters?.batch?.includeUnassigned,
      statuses: filters?.status?.selected,
      gradeLevels: filters?.gradeLevel?.selected,
      graduationStatuses: filters?.graduationStatus?.selected,
      billingTypes: filters?.billingType?.selected,
    },
    client
  )

  return {
    students: result.students,
    totalResults: result.totalCount,
  }
}

/**
 * Find duplicate students by phone number.
 * Uses TypedSQL to identify duplicates in the database, then fetches
 * full profile data via Prisma for the matched profiles only.
 */
export async function findDuplicateStudents() {
  const sqlResults = await prisma.$queryRawTyped(findDuplicateStudentsSql())

  if (sqlResults.length === 0) return []

  const profileIds = Array.from(new Set(sqlResults.map((r) => r.profile_id)))

  const profiles = await prisma.programProfile.findMany({
    where: { id: { in: profileIds } },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          contactPoints: {
            where: {
              type: { in: ['PHONE', 'WHATSAPP'] },
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
        where: {
          isActive: true,
        },
        include: {
          subscription: true,
        },
        take: 1,
      },
    },
  })

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  // Re-group by phone using SQL results' contact_value
  const phoneGroups = new Map<string, ProfileWithRelations[]>()
  for (const row of sqlResults) {
    const profile = profileMap.get(row.profile_id)
    if (!profile) continue
    if (!phoneGroups.has(row.contact_value)) {
      phoneGroups.set(row.contact_value, [])
    }
    const group = phoneGroups.get(row.contact_value)!
    if (!group.some((p) => p.id === profile.id)) {
      group.push(profile)
    }
  }

  const duplicateGroups = Array.from(phoneGroups.entries())
    .filter(([_, group]) => group.length > 1)
    .map(([phone, group]) => {
      const students = group.map(transformToStudent)
      const latestUpdate = Math.max(...group.map((p) => p.updatedAt.getTime()))
      const hasRecentActivity =
        Date.now() - latestUpdate < 30 * 24 * 60 * 60 * 1000

      const sortedProfiles = [...students].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      const keepRecord = sortedProfiles[0]
      const duplicateRecords = sortedProfiles.slice(1)

      return {
        phone,
        email: keepRecord.email || phone,
        profiles: students,
        keepRecord,
        duplicateRecords,
        count: group.length,
        hasSiblingGroup: false,
        hasRecentActivity,
        lastUpdated: latestUpdate,
        differences: null,
      }
    })

  return duplicateGroups
}

/**
 * Resolve duplicate students by keeping one and hard-deleting others.
 * Cascades to enrollments, payments, and billing assignments.
 */
export async function resolveDuplicateStudents(
  keepId: string,
  deleteIds: string[],
  mergeData: boolean = false
) {
  await prisma.$transaction(async (tx) => {
    const keepProfile = await tx.programProfile.findUniqueOrThrow({
      where: { id: keepId },
      relationLoadStrategy: 'join',
      include: {
        person: { include: { contactPoints: true } },
        assignments: true,
      },
    })

    const deleteProfiles = await tx.programProfile.findMany({
      where: { id: { in: deleteIds } },
      relationLoadStrategy: 'join',
      include: {
        person: { include: { contactPoints: true } },
        assignments: true,
      },
    })

    const invalidPrograms = deleteProfiles.filter(
      (p) => p.program !== keepProfile.program
    )
    if (invalidPrograms.length > 0) {
      throw new Error('Cannot merge profiles from different programs')
    }

    if (mergeData) {
      const keepContacts = keepProfile.person.contactPoints
      for (const delProfile of deleteProfiles) {
        for (const contact of delProfile.person.contactPoints) {
          const alreadyExists = keepContacts.some(
            (kc) => kc.type === contact.type && kc.value === contact.value
          )
          if (!alreadyExists) {
            try {
              await tx.contactPoint.create({
                data: {
                  personId: keepProfile.personId,
                  type: contact.type,
                  value: contact.value,
                  isPrimary: false,
                  isActive: contact.isActive,
                },
              })
            } catch (error) {
              if (!isPrismaError(error) || error.code !== 'P2002') {
                throw error
              }
            }
          }
        }
      }

      const billingFields = [
        'graduationStatus',
        'paymentFrequency',
        'billingType',
        'paymentNotes',
      ] as const
      const updates: Record<string, unknown> = {}
      for (const field of billingFields) {
        if (keepProfile[field] == null) {
          for (const delProfile of deleteProfiles) {
            if (delProfile[field] != null) {
              updates[field] = delProfile[field]
              break
            }
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await tx.programProfile.update({
          where: { id: keepId },
          data: updates,
        })
      }

      const allAssignmentIds = deleteProfiles.flatMap((p) =>
        p.assignments.map((a) => a.id)
      )
      if (allAssignmentIds.length > 0) {
        await tx.billingAssignment.updateMany({
          where: { id: { in: allAssignmentIds } },
          data: { programProfileId: keepId },
        })
      }
    }

    await tx.enrollment.updateMany({
      where: { programProfileId: { in: deleteIds } },
      data: { programProfileId: keepId },
    })

    await tx.programProfile.deleteMany({
      where: { id: { in: deleteIds } },
    })

    const deletePersonIds = Array.from(
      new Set(deleteProfiles.map((p) => p.personId))
    ).filter((pid) => pid !== keepProfile.personId)

    for (const personId of deletePersonIds) {
      const remaining = await tx.programProfile.count({
        where: { personId },
      })
      if (remaining === 0) {
        await tx.person.delete({ where: { id: personId } })
      }
    }
  })
}

/**
 * Bulk update student status (updates enrollment status)
 */
export async function bulkUpdateStudentStatus(
  studentIds: string[],
  status: string,
  client: DatabaseClient = prisma
) {
  const enrollmentStatus = studentStatusToEnrollmentStatus(
    status as StudentStatus
  )

  // Update all active enrollments for these profiles
  const result = await client.enrollment.updateMany({
    where: {
      programProfileId: { in: studentIds },
      status: { not: 'WITHDRAWN' },
      endDate: null,
    },
    data: {
      status: enrollmentStatus,
    },
  })

  return result.count
}

/**
 * Get student completeness information
 */
export async function getStudentCompleteness(
  id: string,
  client: DatabaseClient = prisma
) {
  const profile = await client.programProfile.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
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
        take: 1,
      },
    },
  })

  if (!profile) {
    throw new Error('Student not found')
  }

  const requiredFields = [
    'name',
    'email',
    'phone',
    'dateOfBirth',
    'gradeLevel',
    'graduationStatus',
    'billingType',
  ]

  const emailContact = profile.person.contactPoints.find(
    (cp) => cp.type === 'EMAIL'
  )
  const phoneContact = profile.person.contactPoints.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )

  const values = {
    name: profile.person.name,
    email: emailContact?.value,
    phone: phoneContact?.value,
    dateOfBirth: profile.person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    graduationStatus: profile.graduationStatus,
    billingType: profile.billingType,
  }

  const missingFields = requiredFields.filter(
    (field) => !values[field as keyof typeof values]
  )
  const completionPercentage = Math.round(
    ((requiredFields.length - missingFields.length) / requiredFields.length) *
      100
  )

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPercentage,
  }
}

/**
 * Get delete warnings for a student (check for dependencies)
 */
export async function getStudentDeleteWarnings(
  id: string,
  client: DatabaseClient = prisma
) {
  const profile = await client.programProfile.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
          siblingRelationships1: {
            where: { isActive: true },
          },
          siblingRelationships2: {
            where: { isActive: true },
          },
        },
      },
      assignments: {
        where: { isActive: true },
      },
      payments: true,
    },
  })

  if (!profile) {
    return {
      hasSiblings: false,
      hasAttendanceRecords: false,
    }
  }

  return {
    hasSiblings:
      profile.person.siblingRelationships1.length > 0 ||
      profile.person.siblingRelationships2.length > 0,
    hasAttendanceRecords: false, // Attendance not implemented yet
    hasActiveSubscription: profile.assignments.length > 0,
    hasPaymentHistory: profile.payments.length > 0,
  }
}

/**
 * Export students data (returns array for CSV export)
 * Uses select instead of include to fetch only the fields needed for export
 */
export async function exportStudents(
  filters?: {
    search?: {
      query?: string
      fields?: ('name' | 'email' | 'phone')[]
    }
    batch?: {
      selected?: string[]
      includeUnassigned?: boolean
    }
    status?: {
      selected?: string[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
    }
    graduationStatus?: {
      selected?: GraduationStatus[]
    }
    billingType?: {
      selected?: StudentBillingType[]
    }
    dateRange?: {
      from?: Date
      to?: Date
      field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
    }
  },
  client: DatabaseClient = prisma
) {
  const where: Prisma.ProgramProfileWhereInput = {
    program: 'MAHAD_PROGRAM',
  }

  if (filters?.search?.query?.trim()) {
    const searchTerm = filters.search.query.trim()
    const normalizedPhone = normalizePhone(searchTerm)
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
    }
  }

  const batchIds = filters?.batch?.selected ?? []
  if (batchIds.length > 0) {
    const batchConditions: Prisma.EnrollmentWhereInput[] = batchIds.map(
      (batchId) => ({
        batchId,
        status: { not: 'WITHDRAWN' as const },
        endDate: null,
      })
    )
    if (filters?.batch?.includeUnassigned) {
      batchConditions.push({
        batchId: null,
        status: { not: 'WITHDRAWN' as const },
        endDate: null,
      })
    }
    where.enrollments = { some: { OR: batchConditions } }
  }

  if (filters?.status?.selected?.length) {
    const enrollmentStatuses = filters.status.selected.map((s) =>
      studentStatusToEnrollmentStatus(s as StudentStatus)
    )
    const existingSome =
      where.enrollments && 'some' in where.enrollments
        ? where.enrollments.some
        : {}
    where.enrollments = {
      ...where.enrollments,
      some: {
        ...(typeof existingSome === 'object' ? existingSome : {}),
        status: { in: enrollmentStatuses },
        endDate: null,
      },
    }
  }

  if (filters?.gradeLevel?.selected?.length) {
    where.gradeLevel = { in: filters.gradeLevel.selected }
  }
  if (filters?.graduationStatus?.selected?.length) {
    where.graduationStatus = { in: filters.graduationStatus.selected }
  }
  if (filters?.billingType?.selected?.length) {
    where.billingType = { in: filters.billingType.selected }
  }

  const profiles = await client.programProfile.findMany({
    where,
    relationLoadStrategy: 'join',
    select: {
      id: true,
      gradeLevel: true,
      graduationStatus: true,
      billingType: true,
      createdAt: true,
      person: {
        select: {
          name: true,
          contactPoints: {
            select: { type: true, value: true },
          },
        },
      },
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        select: {
          status: true,
          batch: { select: { name: true } },
        },
        orderBy: { startDate: 'desc' as const },
        take: 1,
      },
      assignments: {
        where: { isActive: true },
        select: {
          subscription: { select: { status: true } },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  })

  return profiles.map((p) => {
    const email = p.person.contactPoints.find((c) => c.type === 'EMAIL')
    const phone = p.person.contactPoints.find(
      (c) => c.type === 'PHONE' || c.type === 'WHATSAPP'
    )
    const enrollment = p.enrollments[0]

    return {
      id: p.id,
      name: p.person.name,
      email: email?.value || '',
      phone: phone?.value || '',
      batch: enrollment?.batch?.name || 'Unassigned',
      status: enrollment
        ? enrollmentStatusToStudentStatus(enrollment.status)
        : StudentStatus.REGISTERED,
      gradeLevel: p.gradeLevel || '',
      graduationStatus: p.graduationStatus || '',
      billingType: p.billingType || '',
      subscriptionStatus: p.assignments[0]?.subscription?.status || 'none',
      createdAt: p.createdAt.toISOString(),
    }
  })
}
