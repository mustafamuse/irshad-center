/**
 * Batch Actions Tests
 *
 * Comprehensive tests for batch server actions including:
 * - Batch creation with validation
 * - Batch deletion with safety checks
 * - Student assignment to batches
 * - Student transfers between batches
 * - Duplicate resolution
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  createBatchAction,
  deleteBatchAction,
  assignStudentsAction,
  transferStudentsAction,
  resolveDuplicatesAction,
} from '@/app/batches/actions'
import * as batchQueries from '@/lib/db/queries/batch'
import * as studentQueries from '@/lib/db/queries/student'

// Mock the query modules
vi.mock('@/lib/db/queries/batch')
vi.mock('@/lib/db/queries/student')
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Batch Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBatchAction', () => {
    it('should create a new batch with valid data', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.createBatch).mockResolvedValue(mockBatch)

      const formData = new FormData()
      formData.set('name', 'Spring 2024')
      formData.set('startDate', '2024-01-15')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockBatch)
      expect(batchQueries.createBatch).toHaveBeenCalledWith({
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
      })
    })

    it('should create a batch without a start date', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.createBatch).mockResolvedValue(mockBatch)

      const formData = new FormData()
      formData.set('name', 'Spring 2024')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(true)
      expect(batchQueries.createBatch).toHaveBeenCalledWith({
        name: 'Spring 2024',
        startDate: null,
      })
    })

    it('should return error for duplicate batch name', async () => {
      const error = new Error('Unique constraint failed')
      ;(error as any).code = 'P2002'

      vi.mocked(batchQueries.createBatch).mockRejectedValue(error)

      const formData = new FormData()
      formData.set('name', 'Existing Batch')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('should return validation error for empty name', async () => {
      const formData = new FormData()
      formData.set('name', '')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(batchQueries.createBatch).mockRejectedValue(
        new Error('Database connection failed')
      )

      const formData = new FormData()
      formData.set('name', 'Test Batch')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('deleteBatchAction', () => {
    it('should delete an empty batch', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Empty Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)
      vi.mocked(batchQueries.deleteBatch).mockResolvedValue(undefined)

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(true)
      expect(batchQueries.deleteBatch).toHaveBeenCalledWith('batch-1')
    })

    it('should prevent deletion of batch with students', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Active Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('5 students enrolled')
      expect(batchQueries.deleteBatch).not.toHaveBeenCalled()
    })

    it('should return error for non-existent batch', async () => {
      vi.mocked(batchQueries.getBatchById).mockResolvedValue(null)

      const result = await deleteBatchAction('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Batch not found')
    })

    it('should handle database errors during deletion', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)
      vi.mocked(batchQueries.deleteBatch).mockRejectedValue(
        new Error('Database error')
      )

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should pluralize error message correctly for 1 student', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Batch with One Student',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 1,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('1 student enrolled')
      expect(result.error).not.toContain('students') // Should say "student" not "students"
    })
  })

  describe('assignStudentsAction', () => {
    it('should assign multiple students to a batch', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      const mockResult = {
        success: true,
        assignedCount: 3,
        failedAssignments: [],
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)
      vi.mocked(batchQueries.assignStudentsToBatch).mockResolvedValue(mockResult)

      const result = await assignStudentsAction('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.assignedCount).toBe(3)
      expect(result.data?.failedAssignments).toEqual([])
    })

    it('should return error if batch does not exist', async () => {
      vi.mocked(batchQueries.getBatchById).mockResolvedValue(null)

      const result = await assignStudentsAction('non-existent', ['student-1'])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Batch not found')
    })

    it('should handle partial failures in assignment', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      const mockResult = {
        success: true,
        assignedCount: 2,
        failedAssignments: ['student-3'],
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)
      vi.mocked(batchQueries.assignStudentsToBatch).mockResolvedValue(mockResult)

      const result = await assignStudentsAction('batch-1', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.assignedCount).toBe(2)
      expect(result.data?.failedAssignments).toEqual(['student-3'])
    })

    it('should reject empty student list', async () => {
      const result = await assignStudentsAction('batch-1', [])

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should validate student ID format', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)

      // Test with valid UUIDs
      await assignStudentsAction('batch-1', [
        '550e8400-e29b-41d4-a716-446655440000',
      ])

      // Should not fail validation
      expect(batchQueries.assignStudentsToBatch).toHaveBeenCalled()
    })
  })

  describe('transferStudentsAction', () => {
    it('should transfer students between batches', async () => {
      const mockFromBatch = {
        id: 'batch-1',
        name: 'Fall 2023',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      const mockToBatch = {
        id: 'batch-2',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 3,
      }

      const mockResult = {
        success: true,
        transferredCount: 2,
        failedTransfers: [],
      }

      vi.mocked(batchQueries.getBatchById)
        .mockResolvedValueOnce(mockFromBatch)
        .mockResolvedValueOnce(mockToBatch)
      vi.mocked(batchQueries.transferStudents).mockResolvedValue(mockResult)

      const result = await transferStudentsAction('batch-1', 'batch-2', [
        'student-1',
        'student-2',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.transferredCount).toBe(2)
      expect(result.data?.failedTransfers).toEqual([])
    })

    it('should prevent transfer to the same batch', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(mockBatch)

      const result = await transferStudentsAction('batch-1', 'batch-1', [
        'student-1',
      ])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot transfer within the same batch')
    })

    it('should return error if source batch not found', async () => {
      vi.mocked(batchQueries.getBatchById).mockResolvedValueOnce(null)

      const result = await transferStudentsAction('non-existent', 'batch-2', [
        'student-1',
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Source batch not found')
    })

    it('should return error if destination batch not found', async () => {
      const mockFromBatch = {
        id: 'batch-1',
        name: 'Fall 2023',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      vi.mocked(batchQueries.getBatchById)
        .mockResolvedValueOnce(mockFromBatch)
        .mockResolvedValueOnce(null)

      const result = await transferStudentsAction('batch-1', 'non-existent', [
        'student-1',
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Destination batch not found')
    })

    it('should handle partial transfer failures', async () => {
      const mockFromBatch = {
        id: 'batch-1',
        name: 'Fall 2023',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      const mockToBatch = {
        id: 'batch-2',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 3,
      }

      const mockResult = {
        success: true,
        transferredCount: 2,
        failedTransfers: ['student-3'],
      }

      vi.mocked(batchQueries.getBatchById)
        .mockResolvedValueOnce(mockFromBatch)
        .mockResolvedValueOnce(mockToBatch)
      vi.mocked(batchQueries.transferStudents).mockResolvedValue(mockResult)

      const result = await transferStudentsAction('batch-1', 'batch-2', [
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.transferredCount).toBe(2)
      expect(result.data?.failedTransfers).toEqual(['student-3'])
    })
  })

  describe('resolveDuplicatesAction', () => {
    it('should resolve duplicates and keep specified record', async () => {
      const mockKeepRecord = {
        id: 'student-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        status: 'active',
        batchId: 'batch-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        dateOfBirth: null,
        educationLevel: null,
        gradeLevel: null,
        schoolName: null,
        monthlyRate: 150,
        customRate: false,
      }

      const mockDeleteRecords = [
        {
          ...mockKeepRecord,
          id: 'student-2',
          createdAt: new Date(),
        },
        {
          ...mockKeepRecord,
          id: 'student-3',
          createdAt: new Date(),
        },
      ]

      vi.mocked(studentQueries.getStudentById)
        .mockResolvedValueOnce(mockKeepRecord as any)
        .mockResolvedValueOnce(mockDeleteRecords[0] as any)
        .mockResolvedValueOnce(mockDeleteRecords[1] as any)
      vi.mocked(studentQueries.resolveDuplicateStudents).mockResolvedValue(
        undefined
      )

      const result = await resolveDuplicatesAction(
        'student-1',
        ['student-2', 'student-3'],
        true
      )

      expect(result.success).toBe(true)
      expect(studentQueries.resolveDuplicateStudents).toHaveBeenCalledWith(
        'student-1',
        ['student-2', 'student-3'],
        true
      )
    })

    it('should reject if keepId is in deleteIds', async () => {
      const result = await resolveDuplicatesAction(
        'student-1',
        ['student-1', 'student-2'],
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot delete the record you want to keep')
    })

    it('should reject empty deleteIds array', async () => {
      const result = await resolveDuplicatesAction('student-1', [], false)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No duplicate records selected')
    })

    it('should return error if keep record not found', async () => {
      vi.mocked(studentQueries.getStudentById).mockResolvedValueOnce(null)

      const result = await resolveDuplicatesAction(
        'non-existent',
        ['student-2'],
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Student record to keep not found')
    })

    it('should return error if any delete records not found', async () => {
      const mockKeepRecord = {
        id: 'student-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        status: 'active',
        batchId: 'batch-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        dateOfBirth: null,
        educationLevel: null,
        gradeLevel: null,
        schoolName: null,
        monthlyRate: 150,
        customRate: false,
      }

      vi.mocked(studentQueries.getStudentById)
        .mockResolvedValueOnce(mockKeepRecord as any)
        .mockResolvedValueOnce(null) // First delete record not found

      const result = await resolveDuplicatesAction(
        'student-1',
        ['student-2'],
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Some duplicate records not found')
    })

    it('should handle mergeData option', async () => {
      const mockKeepRecord = {
        id: 'student-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        status: 'active',
        batchId: 'batch-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        dateOfBirth: null,
        educationLevel: null,
        gradeLevel: null,
        schoolName: null,
        monthlyRate: 150,
        customRate: false,
      }

      const mockDeleteRecord = {
        ...mockKeepRecord,
        id: 'student-2',
      }

      vi.mocked(studentQueries.getStudentById)
        .mockResolvedValueOnce(mockKeepRecord as any)
        .mockResolvedValueOnce(mockDeleteRecord as any)
      vi.mocked(studentQueries.resolveDuplicateStudents).mockResolvedValue(
        undefined
      )

      const result = await resolveDuplicatesAction(
        'student-1',
        ['student-2'],
        true // mergeData = true
      )

      expect(result.success).toBe(true)
      expect(studentQueries.resolveDuplicateStudents).toHaveBeenCalledWith(
        'student-1',
        ['student-2'],
        true
      )
    })
  })
})
