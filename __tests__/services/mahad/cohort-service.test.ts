/**
 * Mahad Cohort Service Tests
 *
 * Tests for Mahad batch/cohort management operations.
 * Focus on batch lifecycle, validation, and student management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import { batchFactory } from '../../utils/factories'
import {
  createMahadBatch,
  deleteMahadBatch,
  getMahadBatch,
  getAllMahadBatches,
  getMahadBatchesWithFilters,
  getMahadBatchStudents,
  getMahadBatchStudentCount,
  updateMahadBatch,
  activateMahadBatch,
  deactivateMahadBatch,
} from '@/lib/services/mahad/cohort-service'

// Mock dependencies
vi.mock('@/lib/db/queries/batch', () => ({
  createBatch: vi.fn(),
  deleteBatch: vi.fn(),
  getBatchById: vi.fn(),
  getBatches: vi.fn(),
  getBatchStudents: vi.fn(),
  getBatchStudentCount: vi.fn(),
  getBatchesWithFilters: vi.fn(),
}))

import {
  createBatch,
  deleteBatch,
  getBatchById,
  getBatches,
  getBatchStudents,
  getBatchStudentCount,
  getBatchesWithFilters,
} from '@/lib/db/queries/batch'

describe('MahadCohortService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createMahadBatch', () => {
    it('should create batch with valid dates', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')
      const batch = batchFactory({ startDate, endDate })

      vi.mocked(createBatch).mockResolvedValue(batch as any)

      const result = await createMahadBatch({
        name: 'Fall 2024',
        startDate,
        endDate,
      })

      expect(result).toEqual(batch)
      expect(createBatch).toHaveBeenCalledWith({
        name: 'Fall 2024',
        startDate,
        endDate,
      })
    })

    it('should create batch without end date', async () => {
      const startDate = new Date('2024-01-01')
      const batch = batchFactory({ startDate, endDate: null })

      vi.mocked(createBatch).mockResolvedValue(batch as any)

      await createMahadBatch({
        name: 'Ongoing Batch',
        startDate,
      })

      expect(createBatch).toHaveBeenCalledWith({
        name: 'Ongoing Batch',
        startDate,
        endDate: null,
      })
    })

    it('should throw error if end date is before start date', async () => {
      const startDate = new Date('2024-12-31')
      const endDate = new Date('2024-01-01')

      await expect(
        createMahadBatch({
          name: 'Invalid Batch',
          startDate,
          endDate,
        })
      ).rejects.toThrow('End date must be after start date')

      expect(createBatch).not.toHaveBeenCalled()
    })

    it('should throw error if end date equals start date', async () => {
      const sameDate = new Date('2024-01-01')

      await expect(
        createMahadBatch({
          name: 'Invalid Batch',
          startDate: sameDate,
          endDate: sameDate,
        })
      ).rejects.toThrow('End date must be after start date')
    })
  })

  describe('deleteMahadBatch', () => {
    it('should delete batch with no students', async () => {
      const batch = batchFactory()

      vi.mocked(getBatchStudentCount).mockResolvedValue(0)
      vi.mocked(deleteBatch).mockResolvedValue(batch as any)

      const result = await deleteMahadBatch(batch.id)

      expect(result).toEqual(batch)
      expect(getBatchStudentCount).toHaveBeenCalledWith(batch.id)
      expect(deleteBatch).toHaveBeenCalledWith(batch.id)
    })

    it('should throw error if batch has students', async () => {
      const batch = batchFactory()

      vi.mocked(getBatchStudentCount).mockResolvedValue(5)

      await expect(deleteMahadBatch(batch.id)).rejects.toThrow(
        'Cannot delete batch with 5 enrolled student(s). Withdraw students first.'
      )

      expect(deleteBatch).not.toHaveBeenCalled()
    })

    it('should throw error for single student in batch', async () => {
      const batch = batchFactory()

      vi.mocked(getBatchStudentCount).mockResolvedValue(1)

      await expect(deleteMahadBatch(batch.id)).rejects.toThrow(
        'Cannot delete batch with 1 enrolled student(s). Withdraw students first.'
      )
    })
  })

  describe('getMahadBatch', () => {
    it('should return batch by ID', async () => {
      const batch = batchFactory()

      vi.mocked(getBatchById).mockResolvedValue(batch as any)

      const result = await getMahadBatch(batch.id)

      expect(result).toEqual(batch)
      expect(getBatchById).toHaveBeenCalledWith(batch.id)
    })

    it('should return null if batch not found', async () => {
      vi.mocked(getBatchById).mockResolvedValue(null)

      const result = await getMahadBatch('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getAllMahadBatches', () => {
    it('should return all batches', async () => {
      const batches = [
        batchFactory({ name: 'Fall 2024' }),
        batchFactory({ name: 'Spring 2024' }),
      ]

      vi.mocked(getBatches).mockResolvedValue(batches as any)

      const result = await getAllMahadBatches()

      expect(result).toEqual(batches)
      expect(getBatches).toHaveBeenCalled()
    })

    it('should return empty array if no batches', async () => {
      vi.mocked(getBatches).mockResolvedValue([])

      const result = await getAllMahadBatches()

      expect(result).toHaveLength(0)
    })
  })

  describe('getMahadBatchesWithFilters', () => {
    it('should return filtered batches by search', async () => {
      const batches = [batchFactory({ name: 'Fall 2024' })]

      vi.mocked(getBatchesWithFilters).mockResolvedValue(batches as any)

      const result = await getMahadBatchesWithFilters({ search: 'Fall' })

      expect(result).toEqual(batches)
      expect(getBatchesWithFilters).toHaveBeenCalledWith({ search: 'Fall' })
    })

    it('should return filtered batches by hasStudents', async () => {
      const batches = [batchFactory()]

      vi.mocked(getBatchesWithFilters).mockResolvedValue(batches as any)

      await getMahadBatchesWithFilters({ hasStudents: true })

      expect(getBatchesWithFilters).toHaveBeenCalledWith({ hasStudents: true })
    })

    it('should return filtered batches by date range', async () => {
      const batches = [batchFactory()]
      const dateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
      }

      vi.mocked(getBatchesWithFilters).mockResolvedValue(batches as any)

      await getMahadBatchesWithFilters({ dateRange })

      expect(getBatchesWithFilters).toHaveBeenCalledWith({ dateRange })
    })
  })

  describe('getMahadBatchStudents', () => {
    it('should return students for batch', async () => {
      const students = [
        { id: 'student-1', name: 'Ahmed' },
        { id: 'student-2', name: 'Fatima' },
      ]

      vi.mocked(getBatchStudents).mockResolvedValue(students as any)

      const result = await getMahadBatchStudents('batch-1')

      expect(result).toEqual(students)
      expect(getBatchStudents).toHaveBeenCalledWith('batch-1')
    })

    it('should return empty array if no students', async () => {
      vi.mocked(getBatchStudents).mockResolvedValue([])

      const result = await getMahadBatchStudents('batch-1')

      expect(result).toHaveLength(0)
    })
  })

  describe('getMahadBatchStudentCount', () => {
    it('should return student count for batch', async () => {
      vi.mocked(getBatchStudentCount).mockResolvedValue(15)

      const result = await getMahadBatchStudentCount('batch-1')

      expect(result).toBe(15)
      expect(getBatchStudentCount).toHaveBeenCalledWith('batch-1')
    })

    it('should return zero if no students', async () => {
      vi.mocked(getBatchStudentCount).mockResolvedValue(0)

      const result = await getMahadBatchStudentCount('batch-1')

      expect(result).toBe(0)
    })
  })

  describe('updateMahadBatch', () => {
    it('should update batch name', async () => {
      const batch = batchFactory({ name: 'Updated Name' })

      prismaMock.batch.update.mockResolvedValue(batch as any)

      const result = await updateMahadBatch('batch-1', {
        name: 'Updated Name',
      })

      expect(result).toEqual(batch)
      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { name: 'Updated Name' },
      })
    })

    it('should update batch dates', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')
      const batch = batchFactory({ startDate, endDate })

      prismaMock.batch.update.mockResolvedValue(batch as any)

      await updateMahadBatch('batch-1', { startDate, endDate })

      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { startDate, endDate },
      })
    })

    it('should throw error if new end date is before new start date', async () => {
      const startDate = new Date('2024-12-31')
      const endDate = new Date('2024-01-01')

      await expect(
        updateMahadBatch('batch-1', { startDate, endDate })
      ).rejects.toThrow('End date must be after start date')

      expect(prismaMock.batch.update).not.toHaveBeenCalled()
    })

    it('should update isActive status', async () => {
      const batch = batchFactory({ isActive: false })

      prismaMock.batch.update.mockResolvedValue(batch as any)

      await updateMahadBatch('batch-1', { isActive: false })

      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { isActive: false },
      })
    })

    it('should update multiple fields at once', async () => {
      const batch = batchFactory()

      prismaMock.batch.update.mockResolvedValue(batch as any)

      await updateMahadBatch('batch-1', {
        name: 'New Name',
        isActive: true,
      })

      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          name: 'New Name',
          isActive: true,
        },
      })
    })
  })

  describe('activateMahadBatch', () => {
    it('should activate batch', async () => {
      const batch = batchFactory({ isActive: true })

      prismaMock.batch.update.mockResolvedValue(batch as any)

      const result = await activateMahadBatch('batch-1')

      expect(result).toEqual(batch)
      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { isActive: true },
      })
    })
  })

  describe('deactivateMahadBatch', () => {
    it('should deactivate batch', async () => {
      const batch = batchFactory({ isActive: false })

      prismaMock.batch.update.mockResolvedValue(batch as any)

      const result = await deactivateMahadBatch('batch-1')

      expect(result).toEqual(batch)
      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { isActive: false },
      })
    })
  })
})
