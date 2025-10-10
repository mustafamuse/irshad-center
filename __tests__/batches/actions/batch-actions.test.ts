/**
 * Batch Actions Tests
 *
 * Tests for server-side batch actions with Zod validation and database operations.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  createBatchAction,
  updateBatchAction,
  deleteBatchAction,
} from '@/app/batches/actions/batch-actions'
import * as batchQueries from '@/lib/db/queries/batch'

// Mock the database queries
vi.mock('@/lib/db/queries/batch', () => ({
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  deleteBatch: vi.fn(),
  getBatchById: vi.fn(),
  getBatchByName: vi.fn(),
  getBatchStudentCount: vi.fn(),
}))

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Batch Actions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createBatchAction', () => {
    it('should create batch with valid data', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'Spring 2024')
      formData.append('startDate', '2024-01-15')

      const mockBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchByName).mockResolvedValue(null)
      vi.mocked(batchQueries.createBatch).mockResolvedValue(mockBatch)

      // Act
      const result = await createBatchAction(formData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockBatch)
      expect(batchQueries.getBatchByName).toHaveBeenCalledWith('Spring 2024')
      expect(batchQueries.createBatch).toHaveBeenCalledWith({
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
      })
    })

    it('should reject duplicate batch names', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'Spring 2024')

      const existingBatch = {
        id: 'batch-1',
        name: 'Spring 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(batchQueries.getBatchByName).mockResolvedValue(existingBatch)

      // Act
      const result = await createBatchAction(formData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
      expect(batchQueries.createBatch).not.toHaveBeenCalled()
    })

    it('should validate input with Zod schema', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', '') // Empty name should fail validation

      // Act
      const result = await createBatchAction(formData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(batchQueries.createBatch).not.toHaveBeenCalled()
    })

    it('should handle missing startDate gracefully', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'Winter 2024')

      const mockBatch = {
        id: 'batch-2',
        name: 'Winter 2024',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchByName).mockResolvedValue(null)
      vi.mocked(batchQueries.createBatch).mockResolvedValue(mockBatch)

      // Act
      const result = await createBatchAction(formData)

      // Assert
      expect(result.success).toBe(true)
      expect(batchQueries.createBatch).toHaveBeenCalledWith({
        name: 'Winter 2024',
        startDate: null,
      })
    })
  })

  describe('updateBatchAction', () => {
    it('should update batch with valid data', async () => {
      // Arrange
      const batchId = 'batch-1'
      const formData = new FormData()
      formData.append('name', 'Spring 2024 Updated')
      formData.append('startDate', '2024-02-01')

      const existingBatch = {
        id: batchId,
        name: 'Spring 2024',
        startDate: new Date('2024-01-15'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 5,
      }

      const updatedBatch = {
        ...existingBatch,
        name: 'Spring 2024 Updated',
        startDate: new Date('2024-02-01'),
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(existingBatch)
      vi.mocked(batchQueries.getBatchByName).mockResolvedValue(null)
      vi.mocked(batchQueries.updateBatch).mockResolvedValue(updatedBatch)

      // Act
      const result = await updateBatchAction(batchId, formData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(updatedBatch)
      expect(batchQueries.updateBatch).toHaveBeenCalled()
    })

    it('should return error for invalid batch ID', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'Test Batch')

      // Act
      const result = await updateBatchAction('', formData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid batch ID')
    })

    it('should return error when batch not found', async () => {
      // Arrange
      const batchId = 'non-existent-id'
      const formData = new FormData()
      formData.append('name', 'Test Batch')

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(null)

      // Act
      const result = await updateBatchAction(batchId, formData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should reject duplicate names when updating', async () => {
      // Arrange
      const batchId = 'batch-1'
      const formData = new FormData()
      formData.append('name', 'Existing Batch')

      const existingBatch = {
        id: batchId,
        name: 'Original Name',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      const duplicateBatch = {
        id: 'batch-2',
        name: 'Existing Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(existingBatch)
      vi.mocked(batchQueries.getBatchByName).mockResolvedValue(duplicateBatch)

      // Act
      const result = await updateBatchAction(batchId, formData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })
  })

  describe('deleteBatchAction', () => {
    it('should delete batch when it has no students', async () => {
      // Arrange
      const batchId = 'batch-1'
      const existingBatch = {
        id: batchId,
        name: 'Empty Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 0,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(existingBatch)
      vi.mocked(batchQueries.getBatchStudentCount).mockResolvedValue(0)
      vi.mocked(batchQueries.deleteBatch).mockResolvedValue(undefined)

      // Act
      const result = await deleteBatchAction(batchId)

      // Assert
      expect(result.success).toBe(true)
      expect(batchQueries.deleteBatch).toHaveBeenCalledWith(batchId)
    })

    it('should prevent deletion of batch with students', async () => {
      // Arrange
      const batchId = 'batch-1'
      const existingBatch = {
        id: batchId,
        name: 'Active Batch',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        studentCount: 10,
      }

      vi.mocked(batchQueries.getBatchById).mockResolvedValue(existingBatch)
      vi.mocked(batchQueries.getBatchStudentCount).mockResolvedValue(10)

      // Act
      const result = await deleteBatchAction(batchId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('10 students')
      expect(batchQueries.deleteBatch).not.toHaveBeenCalled()
    })

    it('should return error for invalid batch ID', async () => {
      // Act
      const result = await deleteBatchAction('')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid batch ID')
    })

    it('should return error when batch not found', async () => {
      // Arrange
      const batchId = 'non-existent-id'
      vi.mocked(batchQueries.getBatchById).mockResolvedValue(null)

      // Act
      const result = await deleteBatchAction(batchId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })
})
