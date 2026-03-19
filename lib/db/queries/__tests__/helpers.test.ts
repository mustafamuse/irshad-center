import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockEnrollmentFindMany,
  mockAssignmentFindMany,
  mockSubscriptionFindUnique,
  mockProfileFindMany,
  mockProfileFindFirst,
  mockProfileFindUnique,
} = vi.hoisted(() => ({
  mockEnrollmentFindMany: vi.fn(),
  mockAssignmentFindMany: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockProfileFindMany: vi.fn(),
  mockProfileFindFirst: vi.fn(),
  mockProfileFindUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    enrollment: { findMany: mockEnrollmentFindMany },
    billingAssignment: { findMany: mockAssignmentFindMany },
    subscription: { findUnique: mockSubscriptionFindUnique },
    programProfile: {
      findMany: mockProfileFindMany,
      findFirst: mockProfileFindFirst,
      findUnique: mockProfileFindUnique,
    },
    batch: { findFirst: vi.fn() },
  },
}))

import {
  getActiveEnrollments,
  getAllEnrollments,
  getBillingAssignmentSummary,
  getPersonProgramProfiles,
  getEnrollmentHistory,
  isPersonEnrolled,
} from '../helpers'

describe('helpers queries use relationLoadStrategy: join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActiveEnrollments passes relationLoadStrategy join', async () => {
    mockEnrollmentFindMany.mockResolvedValue([])

    await getActiveEnrollments('profile-1')

    expect(mockEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getAllEnrollments passes relationLoadStrategy join', async () => {
    mockEnrollmentFindMany.mockResolvedValue([])

    await getAllEnrollments('profile-1')

    expect(mockEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getBillingAssignmentSummary passes relationLoadStrategy join', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      id: 'sub-1',
      amount: 10000,
      status: 'active',
    })
    mockAssignmentFindMany.mockResolvedValue([])

    await getBillingAssignmentSummary('sub-1')

    expect(mockAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getPersonProgramProfiles passes relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getPersonProgramProfiles('person-1')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('getEnrollmentHistory passes relationLoadStrategy join', async () => {
    mockEnrollmentFindMany.mockResolvedValue([])

    await getEnrollmentHistory('profile-1')

    expect(mockEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('isPersonEnrolled passes relationLoadStrategy join', async () => {
    mockProfileFindFirst.mockResolvedValue(null)

    await isPersonEnrolled('person-1', 'MAHAD_PROGRAM')

    expect(mockProfileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
