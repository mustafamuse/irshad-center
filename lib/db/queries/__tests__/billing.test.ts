import { StripeAccountType } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockBillingAccountFindFirst,
  mockSubscriptionFindUnique,
  mockSubscriptionFindMany,
  mockAssignmentFindMany,
} = vi.hoisted(() => ({
  mockBillingAccountFindFirst: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  mockAssignmentFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    billingAccount: {
      findFirst: mockBillingAccountFindFirst,
    },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      findMany: mockSubscriptionFindMany,
    },
    billingAssignment: {
      findMany: mockAssignmentFindMany,
    },
  },
}))

import {
  getBillingAccountByPerson,
  getBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId,
  getOrphanedSubscriptions,
  getBillingAssignmentsByProfile,
  getBillingAssignmentsBySubscription,
} from '../billing'

describe('getBillingAccountByPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)

    await getBillingAccountByPerson('person-1', StripeAccountType.MAHAD)

    expect(mockBillingAccountFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getBillingAccountByStripeCustomerId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)

    await getBillingAccountByStripeCustomerId(
      'cus_123',
      StripeAccountType.MAHAD
    )

    expect(mockBillingAccountFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getSubscriptionByStripeId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(null)

    await getSubscriptionByStripeId('sub_123')

    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getOrphanedSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockSubscriptionFindMany.mockResolvedValue([])

    await getOrphanedSubscriptions()

    expect(mockSubscriptionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getBillingAssignmentsByProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockAssignmentFindMany.mockResolvedValue([])

    await getBillingAssignmentsByProfile('profile-1')

    expect(mockAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getBillingAssignmentsBySubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockAssignmentFindMany.mockResolvedValue([])

    await getBillingAssignmentsBySubscription('sub-1')

    expect(mockAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
