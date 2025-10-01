import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

import {
  Batch,
  BatchWithCount,
  BatchSummary,
  BatchAssignmentResult,
} from '../_types'

export class BatchRepository {
  async findAll(): Promise<Batch[]> {
    const batches = await prisma.batch.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return batches.map(this.mapToEntity)
  }

  async findAllWithCount(): Promise<BatchWithCount[]> {
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        _count: {
          select: { students: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      startDate: batch.startDate?.toISOString() ?? null,
      studentCount: batch._count.students,
    }))
  }

  async findById(id: string): Promise<Batch | null> {
    const batch = await prisma.batch.findUnique({
      where: { id },
    })

    return batch ? this.mapToEntity(batch) : null
  }

  async findByName(name: string): Promise<Batch | null> {
    const batch = await prisma.batch.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    return batch ? this.mapToEntity(batch) : null
  }

  async create(data: Prisma.BatchCreateInput): Promise<Batch> {
    const batch = await prisma.batch.create({
      data,
    })

    return this.mapToEntity(batch)
  }

  async update(id: string, data: Prisma.BatchUpdateInput): Promise<Batch> {
    const batch = await prisma.batch.update({
      where: { id },
      data,
    })

    return this.mapToEntity(batch)
  }

  async delete(id: string): Promise<void> {
    await prisma.batch.delete({
      where: { id },
    })
  }

  async getStudentCount(batchId: string): Promise<number> {
    const count = await prisma.student.count({
      where: { batchId },
    })

    return count
  }

  async getBatchStudents(batchId: string) {
    const students = await prisma.student.findMany({
      where: { batchId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        educationLevel: true,
        gradeLevel: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return students
  }

  async assignStudents(
    batchId: string,
    studentIds: string[]
  ): Promise<BatchAssignmentResult> {
    try {
      // Update students in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update all students
        await tx.student.updateMany({
          where: {
            id: { in: studentIds },
          },
          data: {
            batchId,
          },
        })

        // Verify the updates
        const updatedStudents = await tx.student.findMany({
          where: {
            id: { in: studentIds },
          },
          select: {
            id: true,
            name: true,
            batchId: true,
          },
        })

        const successfulAssignments = updatedStudents.filter(
          (s) => s.batchId === batchId
        )
        const failedAssignments = studentIds.filter(
          (id) => !successfulAssignments.some((s) => s.id === id)
        )

        return {
          success: true,
          assignedCount: successfulAssignments.length,
          failedAssignments:
            failedAssignments.length > 0 ? failedAssignments : undefined,
        }
      })

      return result
    } catch (error) {
      return {
        success: false,
        assignedCount: 0,
        errors: [
          error instanceof Error ? error.message : 'Unknown error occurred',
        ],
      }
    }
  }

  async transferStudents(
    fromBatchId: string,
    toBatchId: string,
    studentIds: string[]
  ): Promise<BatchAssignmentResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Verify students are in the source batch
        const studentsInSourceBatch = await tx.student.findMany({
          where: {
            id: { in: studentIds },
            batchId: fromBatchId,
          },
          select: { id: true },
        })

        const validStudentIds = studentsInSourceBatch.map((s) => s.id)
        const invalidStudentIds = studentIds.filter(
          (id) => !validStudentIds.includes(id)
        )

        if (validStudentIds.length === 0) {
          throw new Error('No valid students found in source batch')
        }

        // Transfer valid students
        await tx.student.updateMany({
          where: {
            id: { in: validStudentIds },
          },
          data: {
            batchId: toBatchId,
          },
        })

        return {
          success: true,
          assignedCount: validStudentIds.length,
          failedAssignments:
            invalidStudentIds.length > 0 ? invalidStudentIds : undefined,
        }
      })

      return result
    } catch (error) {
      return {
        success: false,
        assignedCount: 0,
        errors: [
          error instanceof Error ? error.message : 'Unknown error occurred',
        ],
      }
    }
  }

  async getBatchSummary(): Promise<BatchSummary> {
    const [totalBatches, totalStudents, batchesWithStudents] =
      await Promise.all([
        prisma.batch.count(),
        prisma.student.count(),
        prisma.batch.count({
          where: {
            students: {
              some: {},
            },
          },
        }),
      ])

    return {
      totalBatches,
      totalStudents,
      activeBatches: batchesWithStudents,
      averageStudentsPerBatch:
        totalBatches > 0 ? Math.round(totalStudents / totalBatches) : 0,
    }
  }

  async findBatchesWithFilters(filters: any) {
    const where: Prisma.BatchWhereInput = {}

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      }
    }

    if (filters.hasStudents !== undefined) {
      if (filters.hasStudents) {
        where.students = { some: {} }
      } else {
        where.students = { none: {} }
      }
    }

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.from,
        lte: filters.dateRange.to,
      }
    }

    const batches = await prisma.batch.findMany({
      where,
      select: {
        id: true,
        name: true,
        startDate: true,
        _count: {
          select: { students: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      startDate: batch.startDate?.toISOString() ?? null,
      studentCount: batch._count.students,
    }))
  }

  private mapToEntity(batch: any): Batch {
    return {
      id: batch.id,
      name: batch.name,
      startDate: batch.startDate,
      endDate: batch.endDate,
      studentCount: 0, // This would need to be populated separately if needed
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    }
  }
}
