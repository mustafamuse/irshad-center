import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockBatchFindMany,
  mockEnrollmentFindMany,
  mockEnrollmentCount,
  mockBatchFindUnique,
  mockProfileFindMany,
} = vi.hoisted(() => ({
  mockBatchFindMany: vi.fn(),
  mockEnrollmentFindMany: vi.fn(),
  mockEnrollmentCount: vi.fn(),
  mockBatchFindUnique: vi.fn(),
  mockProfileFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    batch: {
      findMany: mockBatchFindMany,
      findUnique: mockBatchFindUnique,
      count: vi.fn().mockResolvedValue(0),
    },
    enrollment: {
      findMany: mockEnrollmentFindMany,
      count: mockEnrollmentCount,
    },
    programProfile: {
      findMany: mockProfileFindMany,
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))

import {
  getBatchStudents,
  getBatchWithEnrollments,
  getUnassignedStudents,
} from '../batch'

describe('getBatchStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockEnrollmentFindMany.mockResolvedValue([])

    await getBatchStudents('batch-1')

    expect(mockEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getBatchWithEnrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockBatchFindUnique.mockResolvedValue(null)

    await getBatchWithEnrollments('batch-1')

    expect(mockBatchFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getUnassignedStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getUnassignedStudents()

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
