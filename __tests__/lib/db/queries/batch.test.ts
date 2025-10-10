/**
 * Batch Query Functions Tests
 *
 * Tests for direct Prisma queries for batch operations including:
 * - Fetching batches with student counts
 * - Creating and updating batches
 * - Student assignment and transfer operations
 * - Batch filtering and search
 * - Summary statistics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  getBatches,
  getBatchById,
  getBatchByName,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchStudents,
  getBatchStudentCount,
  assignStudentsToBatch,
  transferStudents,
  getBatchSummary,
  getBatchesWithFilters,
} from '@/lib/db/queries/batch'
import { prisma } from '@/lib/db'

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    batch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    student: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe('Batch Query Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBatches', () => {
    it('should return all batches with student counts', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { students: 5 },
        },
        {
          id: 'batch-2',
          name: 'Fall 2023',
          startDate: new Date('2023-09-01'),
          endDate: new Date('2023-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { students: 12 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches as any)

      const result = await getBatches()

      expect(result).toHaveLength(2)
      expect(result[0].studentCount).toBe(5)
      expect(result[1].studentCount).toBe(12)
      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          name: true,
          _count: { select: { students: true } },
        }),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should return empty array when no batches exist', async () => {
      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      const result = await getBatches()

      expect(result).toEqual([])
    })
  })

  describe('getBatchById', () => {
    it('should return batch with student count', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 5 },
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(mockBatch as any)

      const result = await getBatchById('batch-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('batch-1')
      expect(result?.studentCount).toBe(5)
    })

    it('should return null for non-existent batch', async () => {
      vi.mocked(prisma.batch.findUnique).mockResolvedValue(null)

      const result = await getBatchById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getBatchByName', () => {
    it('should find batch by exact name (case-insensitive)', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(mockBatch as any)

      const result = await getBatchByName('spring 2024')

      expect(result).toBeDefined()
      expect(result?.name).toBe('Spring 2024')
      expect(prisma.batch.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'spring 2024',
            mode: 'insensitive',
          },
        },
        select: expect.any(Object),
      })
    })

    it('should return null when batch name not found', async () => {
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      const result = await getBatchByName('Non-existent Batch')

      expect(result).toBeNull()
    })
  })

  describe('createBatch', () => {
    it('should create a batch with start date', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 0 },
      }

      vi.mocked(prisma.batch.create).mockResolvedValue(mockBatch as any)

      const result = await createBatch({
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
      })

      expect(result.name).toBe('Spring 2024')
      expect(result.studentCount).toBe(0)
      expect(prisma.batch.create).toHaveBeenCalledWith({
        data: {
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          _count: { select: { students: true } },
        }),
      })
    })

    it('should create a batch without start date', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 0 },
      }

      vi.mocked(prisma.batch.create).mockResolvedValue(mockBatch as any)

      const result = await createBatch({ name: 'Spring 2024' })

      expect(result.startDate).toBeNull()
      expect(prisma.batch.create).toHaveBeenCalledWith({
        data: {
          name: 'Spring 2024',
          startDate: null,
        },
        select: expect.any(Object),
      })
    })
  })

  describe('updateBatch', () => {
    it('should update batch name', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Updated Name',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 5 },
      }

      vi.mocked(prisma.batch.update).mockResolvedValue(mockBatch as any)

      const result = await updateBatch('batch-1', { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })

    it('should update batch dates', async () => {
      const startDate = new Date('2024-01-15')
      const endDate = new Date('2024-06-15')

      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate,
        endDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 5 },
      }

      vi.mocked(prisma.batch.update).mockResolvedValue(mockBatch as any)

      const result = await updateBatch('batch-1', { startDate, endDate })

      expect(result.startDate).toEqual(startDate)
      expect(result.endDate).toEqual(endDate)
    })

    it('should only update provided fields', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Original Name',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 5 },
      }

      vi.mocked(prisma.batch.update).mockResolvedValue(mockBatch as any)

      await updateBatch('batch-1', { startDate: new Date('2024-01-15') })

      expect(prisma.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { startDate: new Date('2024-01-15') },
        select: expect.any(Object),
      })
    })
  })

  describe('deleteBatch', () => {
    it('should delete a batch', async () => {
      vi.mocked(prisma.batch.delete).mockResolvedValue({} as any)

      await deleteBatch('batch-1')

      expect(prisma.batch.delete).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
      })
    })
  })

  describe('getBatchStudents', () => {
    it('should return all students in a batch', async () => {
      const mockStudents = [
        {
          id: 'student-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          status: 'active',
          educationLevel: 'HIGH_SCHOOL',
          gradeLevel: 'FRESHMAN',
          dateOfBirth: new Date('2006-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'student-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '0987654321',
          status: 'active',
          educationLevel: 'HIGH_SCHOOL',
          gradeLevel: 'SOPHOMORE',
          dateOfBirth: new Date('2005-06-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(mockStudents as any)

      const result = await getBatchStudents('batch-1')

      expect(result).toHaveLength(2)
      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      })
    })

    it('should return empty array for batch with no students', async () => {
      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      const result = await getBatchStudents('empty-batch')

      expect(result).toEqual([])
    })
  })

  describe('getBatchStudentCount', () => {
    it('should return student count for a batch', async () => {
      vi.mocked(prisma.student.count).mockResolvedValue(15)

      const result = await getBatchStudentCount('batch-1')

      expect(result).toBe(15)
      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
      })
    })

    it('should return 0 for batch with no students', async () => {
      vi.mocked(prisma.student.count).mockResolvedValue(0)

      const result = await getBatchStudentCount('empty-batch')

      expect(result).toBe(0)
    })
  })

  describe('assignStudentsToBatch', () => {
    it('should assign all students successfully', async () => {
      const mockTransactionFn = vi.fn(async (callback: any) => {
        const tx = {
          student: {
            updateMany: vi.fn().mockResolvedValue({ count: 3 }),
            findMany: vi.fn().mockResolvedValue([
              { id: 'student-1', name: 'Student 1', batchId: 'batch-1' },
              { id: 'student-2', name: 'Student 2', batchId: 'batch-1' },
              { id: 'student-3', name: 'Student 3', batchId: 'batch-1' },
            ]),
          },
        }
        return callback(tx)
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransactionFn as any)

      const result = await assignStudentsToBatch('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.assignedCount).toBe(3)
      expect(result.failedAssignments).toEqual([])
    })

    it('should handle partial assignment failures', async () => {
      const mockTransactionFn = vi.fn(async (callback: any) => {
        const tx = {
          student: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
            findMany: vi.fn().mockResolvedValue([
              { id: 'student-1', name: 'Student 1', batchId: 'batch-1' },
              { id: 'student-2', name: 'Student 2', batchId: 'batch-1' },
              // student-3 failed to update
            ]),
          },
        }
        return callback(tx)
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransactionFn as any)

      const result = await assignStudentsToBatch('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.assignedCount).toBe(2)
      expect(result.failedAssignments).toEqual(['student-3'])
    })
  })

  describe('transferStudents', () => {
    it('should transfer all students successfully', async () => {
      const mockTransactionFn = vi.fn(async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'student-1' },
              { id: 'student-2' },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        }
        return callback(tx)
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransactionFn as any)

      const result = await transferStudents('batch-1', 'batch-2', [
        'student-1',
        'student-2',
      ])

      expect(result.success).toBe(true)
      expect(result.transferredCount).toBe(2)
      expect(result.failedTransfers).toEqual([])
    })

    it('should only transfer students from source batch', async () => {
      const mockTransactionFn = vi.fn(async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'student-1' }, // Only this student is in source batch
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return callback(tx)
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransactionFn as any)

      const result = await transferStudents('batch-1', 'batch-2', [
        'student-1',
        'student-2', // This student is not in source batch
        'student-3', // This student is not in source batch
      ])

      expect(result.success).toBe(true)
      expect(result.transferredCount).toBe(1)
      expect(result.failedTransfers).toEqual(['student-2', 'student-3'])
    })

    it('should throw error if no valid students found', async () => {
      const mockTransactionFn = vi.fn(async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]), // No students in source batch
            updateMany: vi.fn(),
          },
        }
        return callback(tx)
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransactionFn as any)

      await expect(
        transferStudents('batch-1', 'batch-2', ['student-1', 'student-2'])
      ).rejects.toThrow('No valid students found in source batch')
    })
  })

  describe('getBatchSummary', () => {
    it('should return batch statistics', async () => {
      vi.mocked(prisma.batch.count).mockResolvedValueOnce(10) // Total batches
      vi.mocked(prisma.student.count).mockResolvedValue(50) // Total students
      vi.mocked(prisma.batch.count).mockResolvedValueOnce(8) // Active batches

      const result = await getBatchSummary()

      expect(result.totalBatches).toBe(10)
      expect(result.totalStudents).toBe(50)
      expect(result.activeBatches).toBe(8)
      expect(result.averageStudentsPerBatch).toBe(5) // 50 / 10
    })

    it('should handle zero batches gracefully', async () => {
      vi.mocked(prisma.batch.count).mockResolvedValue(0)
      vi.mocked(prisma.student.count).mockResolvedValue(0)

      const result = await getBatchSummary()

      expect(result.averageStudentsPerBatch).toBe(0)
    })
  })

  describe('getBatchesWithFilters', () => {
    it('should filter batches by search term', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: null,
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { students: 5 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches as any)

      await getBatchesWithFilters({ search: 'spring' })

      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'spring',
            mode: 'insensitive',
          },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter batches with students', async () => {
      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      await getBatchesWithFilters({ hasStudents: true })

      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        where: {
          students: { some: {} },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter batches without students', async () => {
      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      await getBatchesWithFilters({ hasStudents: false })

      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        where: {
          students: { none: {} },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter batches by date range', async () => {
      const from = new Date('2024-01-01')
      const to = new Date('2024-12-31')

      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      await getBatchesWithFilters({ dateRange: { from, to } })

      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should combine multiple filters', async () => {
      const from = new Date('2024-01-01')
      const to = new Date('2024-12-31')

      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      await getBatchesWithFilters({
        search: 'spring',
        hasStudents: true,
        dateRange: { from, to },
      })

      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'spring',
            mode: 'insensitive',
          },
          students: { some: {} },
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })
  })
})
