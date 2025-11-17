/**
 * Student Query Functions
 *
 * Direct Prisma queries for student operations following Next.js App Router best practices.
 * These functions replace the Repository/Service pattern with simple, composable query functions.
 */

import {
  Prisma,
  EducationLevel,
  GradeLevel,
  SubscriptionStatus,
} from '@prisma/client'

import { prisma } from '@/lib/db'

/**
 * Get all students with basic information
 */
export async function getStudents() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      batchId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return students
}

/**
 * Get all students with batch and sibling information (excluding withdrawn)
 */
export async function getStudentsWithBatch() {
  const students = await prisma.student.findMany({
    where: {
      status: {
        not: 'withdrawn',
      },
    },
    include: {
      Batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      Sibling: {
        include: {
          Student: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  return students.map((student) => ({
    ...student,
    Sibling: student.Sibling
      ? {
          ...student.Sibling,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }))
}

/**
 * Get students with batch info, filtering, and pagination
 * Server-side version to replace client-side filtering
 */
export async function getStudentsWithBatchFiltered(params: {
  // Pagination
  page?: number
  limit?: number

  // Filters from URL
  search?: string
  batchIds?: string[]
  includeUnassigned?: boolean
  statuses?: string[]
  subscriptionStatuses?: string[]
  educationLevels?: EducationLevel[]
  gradeLevels?: GradeLevel[]
}) {
  const {
    page = 1,
    limit = 50,
    search,
    batchIds,
    includeUnassigned = true,
    statuses,
    subscriptionStatuses,
    educationLevels,
    gradeLevels,
  } = params

  // Build where clause
  const where: Prisma.StudentWhereInput = {
    status: { not: 'withdrawn' },
  }

  // Search across name, email, phone
  if (search && search.trim()) {
    const searchTerm = search.trim()
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { phone: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }

  // Batch filter
  if (batchIds && batchIds.length > 0) {
    if (includeUnassigned) {
      where.OR = [
        ...(where.OR || []),
        { batchId: { in: batchIds } },
        { batchId: null },
      ]
    } else {
      where.batchId = { in: batchIds }
    }
  }

  // Status filter
  if (statuses && statuses.length > 0) {
    where.status = { in: statuses }
  }

  // Subscription status filter
  if (subscriptionStatuses && subscriptionStatuses.length > 0) {
    where.subscriptionStatus = {
      in: subscriptionStatuses as SubscriptionStatus[],
    }
  }

  // Education level filter
  if (educationLevels && educationLevels.length > 0) {
    where.educationLevel = { in: educationLevels }
  }

  // Grade level filter
  if (gradeLevels && gradeLevels.length > 0) {
    where.gradeLevel = { in: gradeLevels }
  }

  // Execute query with pagination
  const [students, totalCount] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        Batch: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        Sibling: {
          include: {
            Student: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
  ])

  // Map to remove self from siblings
  const mappedStudents = students.map((student) => ({
    ...student,
    Sibling: student.Sibling
      ? {
          ...student.Sibling,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }))

  return {
    students: mappedStudents,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  }
}

/**
 * Get a single student by ID
 */
export async function getStudentById(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      batchId: true,
      createdAt: true,
      updatedAt: true,
      Batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      Sibling: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          Student: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  })

  if (!student) return null

  return {
    ...student,
    Sibling: student.Sibling
      ? {
          ...student.Sibling,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }
}

/**
 * Get a student by email (case-insensitive)
 */
export async function getStudentByEmail(email: string) {
  const student = await prisma.student.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      batchId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return student
}

/**
 * Get students by batch ID
 */
export async function getStudentsByBatch(batchId: string) {
  const students = await prisma.student.findMany({
    where: { batchId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      createdAt: true,
      updatedAt: true,
      Batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      Sibling: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          Student: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  return students.map((student) => ({
    ...student,
    Sibling: student.Sibling
      ? {
          ...student.Sibling,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }))
}

/**
 * Get unassigned students (no batch)
 */
export async function getUnassignedStudents() {
  const students = await prisma.student.findMany({
    where: {
      batchId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      createdAt: true,
      updatedAt: true,
      Sibling: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          Student: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  return students.map((student) => ({
    ...student,
    Batch: null,
    Sibling: student.Sibling
      ? {
          id: student.Sibling.id,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }))
}

/**
 * Create a new student
 */
export async function createStudent(data: {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
  batchId?: string | null
}) {
  const student = await prisma.student.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth || null,
      educationLevel: data.educationLevel || null,
      gradeLevel: data.gradeLevel || null,
      schoolName: data.schoolName || null,
      monthlyRate: data.monthlyRate ?? 150,
      customRate: data.customRate ?? false,
      batchId: data.batchId || null,
      status: 'registered', // default status from schema
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      batchId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return student
}

/**
 * Update a student
 */
export async function updateStudent(
  id: string,
  data: {
    name?: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    educationLevel?: EducationLevel | null
    gradeLevel?: GradeLevel | null
    schoolName?: string | null
    status?: string
    monthlyRate?: number
    customRate?: boolean
    batchId?: string | null
  }
) {
  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
      ...(data.educationLevel !== undefined && {
        educationLevel: data.educationLevel,
      }),
      ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
      ...(data.schoolName !== undefined && { schoolName: data.schoolName }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.monthlyRate !== undefined && { monthlyRate: data.monthlyRate }),
      ...(data.customRate !== undefined && { customRate: data.customRate }),
      ...(data.batchId !== undefined && { batchId: data.batchId }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      status: true,
      monthlyRate: true,
      customRate: true,
      batchId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return student
}

/**
 * Delete a student
 */
export async function deleteStudent(id: string) {
  await prisma.student.delete({
    where: { id },
  })
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
    educationLevel?: {
      selected?: EducationLevel[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
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
  }
) {
  const where = buildStudentWhereClause(query, filters)

  const [students, totalCount] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationLevel: true,
        gradeLevel: true,
        schoolName: true,
        status: true,
        monthlyRate: true,
        customRate: true,
        createdAt: true,
        updatedAt: true,
        Batch: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        Sibling: {
          select: {
            id: true,
            Student: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      skip: pagination ? (pagination.page - 1) * pagination.pageSize : 0,
      take: pagination?.pageSize,
    }),
    prisma.student.count({ where }),
  ])

  const mappedStudents = students.map((student) => ({
    ...student,
    Sibling: student.Sibling
      ? {
          id: student.Sibling.id,
          Student: student.Sibling.Student.filter((s) => s.id !== student.id),
        }
      : null,
  }))

  return {
    students: mappedStudents,
    totalResults: totalCount,
  }
}

/**
 * Find duplicate students by phone number
 * Uses exact phone matching only - the most reliable indicator of duplicates
 */
export async function findDuplicateStudents() {
  // Get all students (sorted by oldest first so we keep the first created)
  const allStudents = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      Sibling: {
        select: { id: true },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Group by exact phone number (only if not empty)
  const phoneGroups = new Map<string, typeof allStudents>()
  allStudents.forEach((student) => {
    if (student.phone && student.phone.trim().length > 0) {
      // Normalize phone: remove spaces, dashes, parentheses, and any other non-digit characters
      const normalizedPhone = student.phone.replace(/\D/g, '')
      if (normalizedPhone.length >= 7) {
        // Valid phone number length (at least 7 digits)
        const existing = phoneGroups.get(normalizedPhone) || []
        phoneGroups.set(normalizedPhone, [...existing, student])
      }
    }
  })

  const allDuplicateGroups: Array<{
    email: string
    count: number
    keepRecord: (typeof allStudents)[0]
    duplicateRecords: typeof allStudents
    hasSiblingGroup: boolean
    hasRecentActivity: boolean
    lastUpdated: number
  }> = []

  // Add phone-based duplicates
  Array.from(phoneGroups.entries()).forEach(([phone, students]) => {
    if (students.length > 1) {
      const [keepRecord, ...duplicateRecords] = students

      allDuplicateGroups.push({
        email: `Phone: ${phone}`,
        count: students.length,
        keepRecord,
        duplicateRecords,
        hasSiblingGroup: students.some((s) => s.Sibling),
        hasRecentActivity: students.some(
          (s) =>
            new Date(s.updatedAt).getTime() >
            Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
        ),
        lastUpdated: Math.max(...students.map((s) => s.updatedAt.getTime())),
      })
    }
  })

  return allDuplicateGroups
}

/**
 * Resolve duplicate students by keeping one and deleting others
 */
export async function resolveDuplicateStudents(
  keepId: string,
  deleteIds: string[],
  mergeData: boolean = false
) {
  await prisma.$transaction(async (tx) => {
    if (mergeData) {
      // Get the record to keep and the records to merge
      const [keepRecord, ...deleteRecords] = await Promise.all([
        tx.student.findUnique({ where: { id: keepId } }),
        ...deleteIds.map((id) => tx.student.findUnique({ where: { id } })),
      ])

      if (!keepRecord) throw new Error('Keep record not found')

      // Merge data from delete records into keep record
      const mergedData: Partial<{
        phone: string | null
        dateOfBirth: Date | null
        educationLevel: EducationLevel | null
        gradeLevel: GradeLevel | null
        schoolName: string | null
      }> = {}

      deleteRecords.forEach((record) => {
        if (!record) return
        // Only merge non-null values that are null in the keep record
        if (record.phone && !keepRecord.phone) mergedData.phone = record.phone
        if (record.dateOfBirth && !keepRecord.dateOfBirth)
          mergedData.dateOfBirth = record.dateOfBirth
        if (record.educationLevel && !keepRecord.educationLevel)
          mergedData.educationLevel = record.educationLevel
        if (record.gradeLevel && !keepRecord.gradeLevel)
          mergedData.gradeLevel = record.gradeLevel
        if (record.schoolName && !keepRecord.schoolName)
          mergedData.schoolName = record.schoolName
      })

      // Update the keep record with merged data
      if (Object.keys(mergedData).length > 0) {
        await tx.student.update({
          where: { id: keepId },
          data: mergedData,
        })
      }
    }

    // Delete the duplicate records
    await tx.student.deleteMany({
      where: {
        id: { in: deleteIds },
      },
    })
  })
}

/**
 * Bulk update student status
 */
export async function bulkUpdateStudentStatus(
  studentIds: string[],
  status: string
) {
  const result = await prisma.student.updateMany({
    where: {
      id: { in: studentIds },
    },
    data: {
      status,
    },
  })

  return result.count
}

/**
 * Get student completeness information
 */
export async function getStudentCompleteness(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
    },
  })

  if (!student) {
    throw new Error('Student not found')
  }

  const requiredFields = [
    'name',
    'email',
    'phone',
    'dateOfBirth',
    'educationLevel',
    'gradeLevel',
  ] as const
  const missingFields = requiredFields.filter((field) => !student[field])
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
export async function getStudentDeleteWarnings(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      Sibling: {
        select: {
          Student: { select: { id: true } },
        },
      },
      Attendance: {
        select: { id: true },
        take: 1,
      },
    },
  })

  return {
    hasSiblings: student?.Sibling ? student.Sibling.Student.length > 1 : false,
    hasAttendanceRecords: (student?.Attendance?.length ?? 0) > 0,
  }
}

/**
 * Export students data
 */
export async function exportStudents(filters?: {
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
  educationLevel?: {
    selected?: EducationLevel[]
  }
  gradeLevel?: {
    selected?: GradeLevel[]
  }
  dateRange?: {
    from?: Date
    to?: Date
    field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
  }
}) {
  const where = filters ? buildStudentWhereClause('', filters) : {}

  const students = await prisma.student.findMany({
    where,
    select: {
      name: true,
      email: true,
      phone: true,
      status: true,
      educationLevel: true,
      gradeLevel: true,
      dateOfBirth: true,
      createdAt: true,
      updatedAt: true,
      Batch: {
        select: { name: true },
      },
    },
  })

  return students.map((student) => ({
    name: student.name,
    email: student.email || '',
    phone: student.phone || '',
    batch: student.Batch?.name || 'Unassigned',
    status: student.status,
    educationLevel: student.educationLevel || '',
    gradeLevel: student.gradeLevel || '',
    dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] || '',
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  }))
}

/**
 * Build Prisma where clause for student queries
 */
function buildStudentWhereClause(
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
    educationLevel?: {
      selected?: EducationLevel[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
    }
    dateRange?: {
      from?: Date
      to?: Date
      field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
    }
  }
): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {}

  // Search query
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
    ]
  }

  // Filters
  if (filters) {
    if (filters.batch?.selected?.length) {
      where.batchId = { in: filters.batch.selected }
    }

    if (filters.batch?.includeUnassigned === false) {
      where.batchId = { not: null }
    }

    if (filters.status?.selected?.length) {
      where.status = { in: filters.status.selected }
    }

    if (filters.educationLevel?.selected?.length) {
      where.educationLevel = { in: filters.educationLevel.selected }
    }

    if (filters.gradeLevel?.selected?.length) {
      where.gradeLevel = { in: filters.gradeLevel.selected }
    }

    if (filters.dateRange?.from || filters.dateRange?.to) {
      const field = filters.dateRange.field || 'createdAt'
      where[field] = {
        ...(filters.dateRange.from && { gte: filters.dateRange.from }),
        ...(filters.dateRange.to && { lte: filters.dateRange.to }),
      }
    }
  }

  return where
}
