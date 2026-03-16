import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMany, mockFindFirst, mockFindUnique, mockUpdate } = vi.hoisted(
  () => ({
    mockFindMany: vi.fn(),
    mockFindFirst: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
  })
)

vi.mock('@/lib/db', () => ({
  prisma: {
    enrollment: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

import {
  getEnrollmentsByProgramProfile,
  getActiveEnrollment,
  getEnrollmentsByBatch,
  getEnrollmentById,
  updateEnrollmentStatus,
  getEnrollmentsByProgram,
} from '../enrollment'

describe('enrollment queries use relationLoadStrategy: join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getEnrollmentsByProgramProfile passes relationLoadStrategy join', async () => {
    mockFindMany.mockResolvedValue([])

    await getEnrollmentsByProgramProfile('profile-1')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getActiveEnrollment passes relationLoadStrategy join', async () => {
    mockFindFirst.mockResolvedValue(null)

    await getActiveEnrollment('profile-1')

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getEnrollmentsByBatch passes relationLoadStrategy join', async () => {
    mockFindMany.mockResolvedValue([])

    await getEnrollmentsByBatch('batch-1')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getEnrollmentById passes relationLoadStrategy join', async () => {
    mockFindUnique.mockResolvedValue(null)

    await getEnrollmentById('enr-1')

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('updateEnrollmentStatus lookup passes relationLoadStrategy join', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'enr-1',
      status: 'REGISTERED',
      programProfile: { program: 'MAHAD_PROGRAM' },
    })
    mockUpdate.mockResolvedValue({ id: 'enr-1', status: 'ENROLLED' })

    await updateEnrollmentStatus('enr-1', 'ENROLLED')

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getEnrollmentsByProgram passes relationLoadStrategy join', async () => {
    mockFindMany.mockResolvedValue([])

    await getEnrollmentsByProgram('MAHAD_PROGRAM')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
