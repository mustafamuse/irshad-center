/**
 * Batch Queries Tests
 *
 * Tests for database query functions for batch operations.
 * Note: These tests require mocking Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { prisma } from '@/lib/db'
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

// Mock Prisma Client
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

describe('Batch Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBatches', () => {
    it('should fetch all batches with student count', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
          endDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { students: 10 },
        },
        {
          id: 'batch-2',
          name: 'Fall 2024',
          startDate: new Date('2024-09-01'),
          endDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { students: 5 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches)

      const result = await getBatches()

      expect(result).toHaveLength(2)
      expect(result[0].studentCount).toBe(10)
      expect(result[1].studentCount).toBe(5)
      expect(prisma.batch.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { students: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    it('should return empty array when no batches exist', async () => {
      vi.mocked(prisma.batch.findMany).mockResolvedValue([])

      const result = await getBatches()

      expect(result).toHaveLength(0)
    })
  })

  describe('getBatchById', () => {
    it('should fetch batch by ID with student count', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { students: 10 },
      }

      vi.mocked(prisma.batch.findUnique).mockResolvedValue(mockBatch)

      const result = await getBatchById('batch-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('batch-1')
      expect(result?.studentCount).toBe(10)
      expect(prisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { students: true },
          },
        },
      })
    })

    it('should return null when batch not found', async () => {
      vi.mocked(prisma.batch.findUnique).mockResolvedValue(null)

      const result = await getBatchById('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('getBatchByName', () => {
    it('should fetch batch by name (case-insensitive)', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(prisma.batch.findFirst).mockResolvedValue(mockBatch)

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
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should return null when batch not found', async () => {
      vi.mocked(prisma.batch.findFirst).mockResolvedValue(null)

      const result = await getBatchByName('Non-existent Batch')

      expect(result).toBeNull()
    })
  })

  describe('createBatch', () => {
    it('should create batch with valid data', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { students: 0 },
      }

      vi.mocked(prisma.batch.create).mockResolvedValue(mockBatch)

      const result = await createBatch({
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('Spring 2024')
      expect(result.studentCount).toBe(0)
      expect(prisma.batch.create).toHaveBeenCalledWith({
        data: {
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { students: true },
          },
        },
      })
    })

    it('should create batch with null startDate', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Winter 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { students: 0 },
      }

      vi.mocked(prisma.batch.create).mockResolvedValue(mockBatch)

      const result = await createBatch({
        name: 'Winter 2024',
        startDate: null,
      })

      expect(result.startDate).toBeNull()
    })
  })

  describe('updateBatch', () => {
    it('should update batch with provided data', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024 Updated',
        startDate: new Date('2024-02-01'),
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01'),
        _count: { students: 10 },
      }

      vi.mocked(prisma.batch.update).mockResolvedValue(mockBatch)

      const result = await updateBatch('batch-1', {
        name: 'Spring 2024 Updated',
        startDate: new Date('2024-02-01'),
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('Spring 2024 Updated')
      expect(prisma.batch.update).toHaveBeenCalled()
    })

    it('should handle partial updates', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Original Name',
        startDate: new Date('2024-02-01'),
        endDate: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01'),
        _count: { students: 10 },
      }

      vi.mocked(prisma.batch.update).mockResolvedValue(mockBatch)

      const result = await updateBatch('batch-1', {
        startDate: new Date('2024-02-01'),
      })

      expect(result.startDate).toEqual(new Date('2024-02-01'))
    })
  })

  describe('deleteBatch', () => {
    it('should delete batch by ID', async () => {
      vi.mocked(prisma.batch.delete).mockResolvedValue({
        id: 'batch-1',
        name: 'Deleted Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await deleteBatch('batch-1')

      expect(prisma.batch.delete).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
      })
    })
  })

  describe('getBatchStudents', () => {
    it('should fetch all students in a batch', async () => {
      const mockStudents = [
        {
          id: 'student-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          status: 'ACTIVE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'GRADE_1',
          dateOfBirth: new Date('2010-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(mockStudents)

      const result = await getBatchStudents('batch-1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          educationLevel: true,
          gradeLevel: true,
          dateOfBirth: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      })
    })
  })

  describe('getBatchStudentCount', () => {
    it('should count students in a batch', async () => {
      vi.mocked(prisma.student.count).mockResolvedValue(15)

      const result = await getBatchStudentCount('batch-1')

      expect(result).toBe(15)
      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
      })
    })
  })

  describe('assignStudentsToBatch', () => {
    it('should assign students to batch successfully', async () => {
      const mockTransaction = vi.fn().mockResolvedValue({
        success: true,
        assignedCount: 3,
        failedAssignments: [],
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await assignStudentsToBatch('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.assignedCount).toBe(3)
      expect(result.failedAssignments).toHaveLength(0)
    })

    it('should report failed assignments', async () => {
      const mockTransaction = vi.fn().mockResolvedValue({
        success: true,
        assignedCount: 2,
        failedAssignments: ['student-3'],
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await assignStudentsToBatch('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.assignedCount).toBe(2)
      expect(result.failedAssignments).toContain('student-3')
    })
  })

  describe('transferStudents', () => {
    it('should transfer students between batches', async () => {
      const mockTransaction = vi.fn().mockResolvedValue({
        success: true,
        transferredCount: 2,
        failedTransfers: [],
      })

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await transferStudents('batch-1', 'batch-2', [
        'student-1',
        'student-2',
      ])

      expect(result.success).toBe(true)
      expect(result.transferredCount).toBe(2)
    })

    it('should handle transfer errors gracefully', async () => {
      const mockTransaction = vi
        .fn()
        .mockRejectedValue(new Error('No valid students found in source batch'))

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        transferStudents('batch-1', 'batch-2', ['invalid-student'])
      ).rejects.toThrow('No valid students found in source batch')
    })
  })

  describe('getBatchSummary', () => {
    it('should fetch batch statistics', async () => {
      vi.mocked(prisma.batch.count)
        .mockResolvedValueOnce(10) // totalBatches
        .mockResolvedValueOnce(5) // batchesWithStudents

      vi.mocked(prisma.student.count).mockResolvedValue(50) // totalStudents

      const result = await getBatchSummary()

      expect(result.totalBatches).toBe(10)
      expect(result.totalStudents).toBe(50)
      expect(result.activeBatches).toBe(5)
      expect(result.averageStudentsPerBatch).toBe(5) // 50 / 10
    })

    it('should handle zero batches', async () => {
      vi.mocked(prisma.batch.count)
        .mockResolvedValueOnce(0) // totalBatches
        .mockResolvedValueOnce(0) // batchesWithStudents

      vi.mocked(prisma.student.count).mockResolvedValue(0) // totalStudents

      const result = await getBatchSummary()

      expect(result.totalBatches).toBe(0)
      expect(result.averageStudentsPerBatch).toBe(0)
    })
  })

  describe('getBatchesWithFilters', () => {
    it('should filter batches by search query', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
          endDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { students: 10 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches)

      const result = await getBatchesWithFilters({ search: 'spring' })

      expect(result).toHaveLength(1)
      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'spring',
              mode: 'insensitive',
            },
          }),
        })
      )
    })

    it('should filter batches with students', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
          endDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { students: 10 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches)

      const result = await getBatchesWithFilters({ hasStudents: true })

      expect(result).toHaveLength(1)
      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            students: { some: {} },
          }),
        })
      )
    })

    it('should filter batches by date range', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Spring 2024',
          startDate: new Date('2024-01-15'),
          endDate: null,
          createdAt: new Date('2024-06-01'),
          updatedAt: new Date('2024-06-01'),
          _count: { students: 10 },
        },
      ]

      vi.mocked(prisma.batch.findMany).mockResolvedValue(mockBatches)

      const result = await getBatchesWithFilters({
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      })

      expect(result).toHaveLength(1)
      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        })
      )
    })
  })
})
