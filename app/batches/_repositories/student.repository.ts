import { Prisma, EducationLevel, GradeLevel } from '@prisma/client'

import { prisma } from '@/lib/db'

import {
  Student,
  BatchStudentData,
  StudentFilters,
  StudentStatus,
  DuplicateGroup,
  StudentCompletenessCheck,
  CreateStudentDto,
  UpdateStudentDto,
  PaginationInput,
} from '../_types'

export class StudentRepository {
  async findAll(): Promise<Student[]> {
    const students = await prisma.student.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return students.map(this.mapToEntity)
  }

  async findAllWithBatch(): Promise<BatchStudentData[]> {
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
        createdAt: true,
        updatedAt: true,
        batch: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        siblingGroup: {
          select: {
            id: true,
            students: {
              select: {
                id: true,
                name: true,
                status: true,
              },
              where: {
                id: { not: undefined }, // This will be replaced with actual student id in implementation
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
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
      educationLevel: student.educationLevel,
      gradeLevel: student.gradeLevel,
      schoolName: student.schoolName,
      status: student.status,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      batch: student.batch
        ? {
            id: student.batch.id,
            name: student.batch.name,
            startDate: student.batch.startDate?.toISOString() ?? null,
            endDate: student.batch.endDate?.toISOString() ?? null,
          }
        : null,
      siblingGroup: student.siblingGroup
        ? {
            id: student.siblingGroup.id,
            students: student.siblingGroup.students.filter(
              (s) => s.id !== student.id
            ),
          }
        : null,
    }))
  }

  async findById(id: string): Promise<Student | null> {
    const student = await prisma.student.findUnique({
      where: { id },
    })

    return student ? this.mapToEntity(student) : null
  }

  async findByEmail(email: string): Promise<Student | null> {
    const student = await prisma.student.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    })

    return student ? this.mapToEntity(student) : null
  }

  async findByBatch(batchId: string): Promise<BatchStudentData[]> {
    const students = await this.findAllWithBatch()
    return students.filter((student) => student.batch?.id === batchId)
  }

  async findUnassigned(): Promise<BatchStudentData[]> {
    const students = await this.findAllWithBatch()
    return students.filter((student) => !student.batch)
  }

  async search(
    query: string,
    filters?: StudentFilters,
    pagination?: PaginationInput
  ): Promise<{ students: BatchStudentData[]; totalResults: number }> {
    const where = this.buildWhereClause(query, filters)

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
          createdAt: true,
          updatedAt: true,
          batch: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          },
          siblingGroup: {
            select: {
              id: true,
              students: {
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
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
      educationLevel: student.educationLevel,
      gradeLevel: student.gradeLevel,
      schoolName: student.schoolName,
      status: student.status,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      batch: student.batch
        ? {
            id: student.batch.id,
            name: student.batch.name,
            startDate: student.batch.startDate?.toISOString() ?? null,
            endDate: student.batch.endDate?.toISOString() ?? null,
          }
        : null,
      siblingGroup: student.siblingGroup
        ? {
            id: student.siblingGroup.id,
            students: student.siblingGroup.students.filter(
              (s) => s.id !== student.id
            ),
          }
        : null,
    }))

    return {
      students: mappedStudents,
      totalResults: totalCount,
    }
  }

  async create(data: CreateStudentDto): Promise<Student> {
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
        status: StudentStatus.ACTIVE,
      },
    })

    return this.mapToEntity(student)
  }

  async update(id: string, data: UpdateStudentDto): Promise<Student> {
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth,
        }),
        ...(data.educationLevel !== undefined && {
          educationLevel: data.educationLevel,
        }),
        ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
        ...(data.schoolName !== undefined && {
          schoolName: data.schoolName || null,
        }),
        ...(data.status && { status: data.status }),
        ...(data.monthlyRate !== undefined && {
          monthlyRate: data.monthlyRate ?? 150,
        }),
        ...(data.customRate !== undefined && {
          customRate: data.customRate ?? false,
        }),
        ...(data.batchId !== undefined && { batchId: data.batchId }),
      },
    })

    return this.mapToEntity(student)
  }

  async delete(id: string): Promise<void> {
    await prisma.student.delete({
      where: { id },
    })
  }

  async bulkUpdateStatus(
    studentIds: string[],
    status: StudentStatus
  ): Promise<number> {
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

  async findDuplicates(): Promise<DuplicateGroup[]> {
    // Find students with duplicate emails
    const duplicateEmails = await prisma.student.groupBy({
      by: ['email'],
      having: {
        email: {
          _count: {
            gt: 1,
          },
        },
      },
      where: {
        email: {
          not: null,
        },
      },
    })

    const duplicateGroups = await Promise.all(
      duplicateEmails.map(async ({ email }) => {
        if (!email) return null

        const students = await prisma.student.findMany({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            siblingGroup: {
              select: { id: true },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        if (students.length < 2) return null

        const [keepRecord, ...duplicateRecords] = students

        return {
          email,
          count: students.length,
          keepRecord: {
            id: keepRecord.id,
            name: keepRecord.name,
            email: keepRecord.email,
            status: keepRecord.status,
            createdAt: keepRecord.createdAt.toISOString(),
            updatedAt: keepRecord.updatedAt.toISOString(),
            siblingGroup: keepRecord.siblingGroup,
          },
          duplicateRecords: duplicateRecords.map((record) => ({
            id: record.id,
            name: record.name,
            email: record.email,
            status: record.status,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
            siblingGroup: record.siblingGroup,
          })),
          hasSiblingGroup: students.some((s) => s.siblingGroup),
          hasRecentActivity: students.some(
            (s) =>
              new Date(s.updatedAt).getTime() >
              Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
          ),
          differences: null, // Would need to implement field comparison
          lastUpdated: Math.max(
            ...students.map((s) => s.updatedAt.getTime())
          ).toString(),
        }
      })
    )

    return duplicateGroups.filter(
      (group): group is NonNullable<typeof group> => group !== null
    ) as DuplicateGroup[]
  }

  async resolveDuplicates(
    keepId: string,
    deleteIds: string[],
    mergeData: boolean
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      if (mergeData) {
        // Get the record to keep and the records to merge
        const [keepRecord, ...deleteRecords] = await Promise.all([
          tx.student.findUnique({ where: { id: keepId } }),
          ...deleteIds.map((id) => tx.student.findUnique({ where: { id } })),
        ])

        if (!keepRecord) throw new Error('Keep record not found')

        // Merge data from delete records into keep record
        // This is a simplified version - you'd want more sophisticated merging logic
        const mergedData: Record<string, unknown> = {}

        deleteRecords.forEach((record) => {
          if (!record) return
          // Only merge non-null values that are null in the keep record
          Object.keys(record).forEach((key) => {
            if (
              record[key as keyof typeof record] &&
              !keepRecord[key as keyof typeof keepRecord]
            ) {
              mergedData[key] = record[key as keyof typeof record]
            }
          })
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

  async getDeleteWarnings(id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        siblingGroup: {
          select: {
            students: { select: { id: true } },
          },
        },
      },
    })

    return {
      hasSiblings: student?.siblingGroup
        ? student.siblingGroup.students.length > 1
        : false,
      hasPayments: false, // Would need to check payment records if they exist
    }
  }

  async getCompleteness(id: string): Promise<StudentCompletenessCheck> {
    const student = await prisma.student.findUnique({
      where: { id },
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

  async export(
    format: 'csv' | 'xlsx' | 'json',
    filters?: StudentFilters,
    _fields?: string[]
  ) {
    const where = filters ? this.buildWhereClause('', filters) : {}

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
        batch: {
          select: { name: true },
        },
      },
    })

    const exportData = students.map((student) => ({
      name: student.name,
      email: student.email || '',
      phone: student.phone || '',
      batch: student.batch?.name || 'Unassigned',
      status: student.status,
      educationLevel: student.educationLevel || '',
      gradeLevel: student.gradeLevel || '',
      dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] || '',
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    }))

    return {
      data: exportData,
      format,
      filename: `students_export_${new Date().toISOString().split('T')[0]}.${format}`,
    }
  }

  private buildWhereClause(
    query?: string,
    filters?: StudentFilters
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

  private mapToEntity(student: Record<string, unknown>): Student {
    return {
      id: student.id as string,
      name: student.name as string,
      email: student.email as string | null,
      phone: student.phone as string | null,
      dateOfBirth: student.dateOfBirth as Date | null,
      educationLevel: student.educationLevel as EducationLevel | null,
      gradeLevel: student.gradeLevel as GradeLevel | null,
      schoolName: student.schoolName as string | null,
      status: student.status as StudentStatus,
      monthlyRate: student.monthlyRate as number,
      customRate: student.customRate as boolean,
      batchId: student.batchId as string | null,
      createdAt: student.createdAt as Date,
      updatedAt: student.updatedAt as Date,
    }
  }
}
