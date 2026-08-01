import { StripeAccountType } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockBillingAccountFindFirst,
  mockBillingAccountCreate,
  mockBillingAccountUpdate,
  mockSubscriptionFindUnique,
  mockSubscriptionFindMany,
  mockAssignmentFindMany,
} = vi.hoisted(() => ({
  mockBillingAccountFindFirst: vi.fn(),
  mockBillingAccountCreate: vi.fn(),
  mockBillingAccountUpdate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  mockAssignmentFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    billingAccount: {
      findFirst: mockBillingAccountFindFirst,
      create: mockBillingAccountCreate,
      update: mockBillingAccountUpdate,
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
  upsertBillingAccount,
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

describe('upsertBillingAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include personId in where clause when provided', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)
    mockBillingAccountCreate.mockResolvedValue({ id: 'ba-1' })

    await upsertBillingAccount({
      personId: 'person-123',
      accountType: StripeAccountType.DUGSI,
    })

    expect(mockBillingAccountFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          personId: 'person-123',
          accountType: 'DUGSI',
        },
      })
    )
  })

  it('should NOT include personId in where clause when personId is null', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)
    mockBillingAccountCreate.mockResolvedValue({ id: 'ba-1' })

    await upsertBillingAccount({
      personId: null,
      accountType: StripeAccountType.DUGSI,
    })

    const callArgs = mockBillingAccountFindFirst.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('personId')
    expect(callArgs.where.accountType).toBe('DUGSI')
  })

  it('should NOT include personId in where clause when personId is undefined', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)
    mockBillingAccountCreate.mockResolvedValue({ id: 'ba-1' })

    await upsertBillingAccount({
      accountType: StripeAccountType.MAHAD,
    })

    const callArgs = mockBillingAccountFindFirst.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('personId')
    expect(callArgs.where.accountType).toBe('MAHAD')
  })

  it('should NOT include personId in where clause when personId is empty string', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)
    mockBillingAccountCreate.mockResolvedValue({ id: 'ba-1' })

    await upsertBillingAccount({
      personId: '',
      accountType: StripeAccountType.DUGSI,
    })

    const callArgs = mockBillingAccountFindFirst.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('personId')
  })

  it('should update existing account when found', async () => {
    const existing = { id: 'ba-existing', stripeCustomerIdDugsi: 'cus_old' }
    mockBillingAccountFindFirst.mockResolvedValue(existing)
    mockBillingAccountUpdate.mockResolvedValue({ id: 'ba-existing' })

    await upsertBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.DUGSI,
      stripeCustomerIdDugsi: 'cus_new',
    })

    expect(mockBillingAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ba-existing' },
      })
    )
    expect(mockBillingAccountCreate).not.toHaveBeenCalled()
  })

  it('should create new account when not found', async () => {
    mockBillingAccountFindFirst.mockResolvedValue(null)
    mockBillingAccountCreate.mockResolvedValue({ id: 'ba-new' })

    await upsertBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.DUGSI,
    })

    expect(mockBillingAccountCreate).toHaveBeenCalled()
    expect(mockBillingAccountUpdate).not.toHaveBeenCalled()
  })
})
