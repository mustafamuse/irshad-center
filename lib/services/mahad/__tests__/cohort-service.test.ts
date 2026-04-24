import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUpdateBatch } = vi.hoisted(() => ({
  mockUpdateBatch: vi.fn(),
}))

vi.mock('@/lib/db/queries/batch', () => ({
  updateBatch: (...args: unknown[]) => mockUpdateBatch(...args),
  createBatch: vi.fn(),
  deleteBatch: vi.fn(),
  getBatchById: vi.fn(),
  getBatches: vi.fn(),
  getBatchStudents: vi.fn(),
  getBatchStudentCount: vi.fn(),
  getBatchesWithFilters: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
}))

import {
  activateMahadBatch,
  deactivateMahadBatch,
  updateMahadBatch,
} from '../cohort-service'

describe('updateMahadBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateBatch.mockResolvedValue({ id: 'batch-1', studentCount: 0 })
  })

  it('delegates to the query-layer updateBatch instead of calling prisma directly', async () => {
    await updateMahadBatch('batch-1', { name: 'Fall 2026' })

    expect(mockUpdateBatch).toHaveBeenCalledTimes(1)
    expect(mockUpdateBatch).toHaveBeenCalledWith('batch-1', {
      name: 'Fall 2026',
    })
  })

  it('rejects when endDate is on or before startDate', async () => {
    const same = new Date('2026-09-01')
    await expect(
      updateMahadBatch('batch-1', { startDate: same, endDate: same })
    ).rejects.toMatchObject({
      message: 'End date must be after start date',
      field: 'endDate',
    })
    expect(mockUpdateBatch).not.toHaveBeenCalled()
  })

  it('logs and rethrows when the underlying query throws', async () => {
    const boom = new Error('db unavailable')
    mockUpdateBatch.mockRejectedValueOnce(boom)

    await expect(updateMahadBatch('batch-1', { name: 'X' })).rejects.toBe(boom)
  })
})

describe('activate/deactivate batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateBatch.mockResolvedValue({ id: 'batch-1', studentCount: 0 })
  })

  it('activateMahadBatch flips isActive to true via the query layer', async () => {
    await activateMahadBatch('batch-1')
    expect(mockUpdateBatch).toHaveBeenCalledWith('batch-1', { isActive: true })
  })

  it('deactivateMahadBatch flips isActive to false via the query layer', async () => {
    await deactivateMahadBatch('batch-1')
    expect(mockUpdateBatch).toHaveBeenCalledWith('batch-1', { isActive: false })
  })
})
