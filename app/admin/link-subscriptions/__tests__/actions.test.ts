// ⚠️ CRITICAL MIGRATION NEEDED: This test file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model
// All tests are skipped until migration is complete

/**
 * Link Subscriptions Server Actions Tests
 *
 * Comprehensive test suite for link-subscriptions admin server actions
 * Tests cover happy paths, edge cases, and error scenarios with DRY principles
 */

import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

import {
  getOrphanedSubscriptions,
  searchStudents,
  getPotentialMatches,
  linkSubscriptionToStudent,
} from '../actions'

// ============================================================================
// MOCKS SETUP
// ============================================================================

// Create mock Stripe clients
const mockMahadStripeClient = {
  subscriptions: {
    list: vi.fn(),
    retrieve: vi.fn(),
  },
}

const mockDugsiStripeClient = {
  subscriptions: {
    list: vi.fn(),
    retrieve: vi.fn(),
  },
}

// Mock Stripe constructor to return our mock clients
vi.mock('stripe', () => {
  return {
    default: vi.fn((key: string) => {
      if (
        key === process.env.STRIPE_SECRET_KEY_PROD ||
        key === 'sk_test_prod'
      ) {
        return mockMahadStripeClient
      }
      return mockDugsiStripeClient
    }),
  }
})

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock Prisma
vi.mock('@/lib/db', () => {
  const mockStudent = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  }

  return {
    prisma: {
      student: mockStudent,
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        // Create a transaction client that uses the same mocks
        const tx = { student: mockStudent }
        return callback(tx)
      }),
    },
  }
})

// Mock Stripe Dugsi
vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => mockDugsiStripeClient),
}))

// Mock utility functions
vi.mock('@/lib/queries/subscriptions', () => ({
  getNewStudentStatus: vi.fn((status: string) => {
    const statusMap: Record<string, string> = {
      active: 'enrolled',
      trialing: 'enrolled',
      past_due: 'enrolled',
      canceled: 'withdrawn',
      unpaid: 'withdrawn',
      incomplete: 'registered',
      incomplete_expired: 'registered',
    }
    return statusMap[status] || 'registered'
  }),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractCustomerId: vi.fn((customer: unknown) => {
    if (!customer) return ''
    if (typeof customer === 'string') return customer
    return (customer as unknown as Record<string, unknown>).id || ''
  }),
  extractPeriodDates: vi.fn((subscription: unknown) => {
    const sub = subscription as unknown as Record<string, unknown>
    return {
      periodStart: sub.current_period_start
        ? new Date((sub.current_period_start as number) * 1000)
        : null,
      periodEnd: sub.current_period_end
        ? new Date((sub.current_period_end as number) * 1000)
        : null,
    }
  }),
}))

// ============================================================================
// MOCK FACTORIES & FIXTURES (DRY)
// ============================================================================

const MOCK_TIMESTAMP = 1700000000
const MOCK_PERIOD_START = MOCK_TIMESTAMP
const MOCK_PERIOD_END = MOCK_TIMESTAMP + 30 * 24 * 60 * 60

const MOCK_IDS = {
  subscription: 'sub_test123',
  customer: 'cus_test123',
  student: 'student_test123',
}

const MOCK_PRICES = {
  mahad: 25000,
  dugsi: 15000,
}

function createMockStripeSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  return {
    id: MOCK_IDS.subscription,
    object: 'subscription',
    customer: MOCK_IDS.customer,
    status: 'active',
    current_period_start: MOCK_PERIOD_START,
    current_period_end: MOCK_PERIOD_END,
    created: MOCK_TIMESTAMP,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          price: {
            id: 'price_test123',
            object: 'price',
            unit_amount: MOCK_PRICES.mahad,
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    metadata: {},
    ...overrides,
  } as Stripe.Subscription
}

function createMockStripeCustomer(
  overrides?: Partial<Stripe.Customer>
): Stripe.Customer {
  return {
    id: MOCK_IDS.customer,
    object: 'customer',
    email: 'customer@example.com',
    name: 'Test Customer',
    metadata: {},
    ...overrides,
  } as Stripe.Customer
}

function createMockStudent(
  program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
  overrides?: unknown
) {
  if (program === 'MAHAD_PROGRAM') {
    return {
      id: MOCK_IDS.student,
      name: 'Test Student',
      program,
      email: 'student@example.com',
      phone: '1234567890',
      status: 'registered',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      previousSubscriptionIds: [],
      ...overrides,
    }
  }

  return {
    id: MOCK_IDS.student,
    name: 'Test Student',
    program,
    email: 'student@example.com',
    phone: '1234567890',
    parentEmail: 'parent@example.com',
    parentPhone: '1234567890',
    status: 'registered',
    stripeSubscriptionIdDugsi: null,
    stripeCustomerIdDugsi: null,
    subscriptionStatus: null,
    previousSubscriptionIdsDugsi: [],
    ...overrides,
  }
}

function createPaginatedStripeResponse(
  data: unknown[],
  hasMore: boolean = false
): Stripe.ApiList<unknown> {
  return {
    object: 'list',
    data,
    has_more: hasMore,
    url: '/v1/subscriptions',
  } as Stripe.ApiList<unknown>
}

// ============================================================================
// TESTS
// ============================================================================

describe.skip('Link Subscriptions Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.error = vi.fn()
    process.env.STRIPE_SECRET_KEY_PROD = 'sk_test_prod'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOrphanedSubscriptions', () => {
    describe('Happy Path', () => {
      it('should return orphaned Mahad subscriptions not linked in database', async () => {
        const mockSubscription = createMockStripeSubscription({
          customer: createMockStripeCustomer(),
        })

        mockMahadStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([mockSubscription])
        )
        mockDugsiStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([])
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([])

        const result = await getOrphanedSubscriptions()

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
          id: MOCK_IDS.subscription,
          customerId: MOCK_IDS.customer,
          customerEmail: 'customer@example.com',
          customerName: 'Test Customer',
          status: 'active',
          program: 'MAHAD',
        })
      })

      it('should return orphaned Dugsi subscriptions', async () => {
        const mockSubscription = createMockStripeSubscription({
          customer: createMockStripeCustomer(),
        })

        mockMahadStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([])
        )
        mockDugsiStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([mockSubscription])
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([])

        const result = await getOrphanedSubscriptions()

        expect(result).toHaveLength(1)
        expect(result[0].program).toBe('DUGSI')
      })

      it('should handle pagination correctly', async () => {
        const mockSub1 = createMockStripeSubscription({ id: 'sub_1' })
        const mockSub2 = createMockStripeSubscription({ id: 'sub_2' })

        mockMahadStripeClient.subscriptions.list
          .mockResolvedValueOnce(
            createPaginatedStripeResponse([mockSub1], true)
          )
          .mockResolvedValueOnce(
            createPaginatedStripeResponse([mockSub2], false)
          )
        mockDugsiStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([])
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([])

        const result = await getOrphanedSubscriptions()

        expect(result).toHaveLength(2)
        expect(mockMahadStripeClient.subscriptions.list).toHaveBeenCalledTimes(
          2
        )
      })
    })

    describe('Edge Cases', () => {
      it('should return empty array when all subscriptions are linked', async () => {
        const mockSubscription = createMockStripeSubscription()

        mockMahadStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([mockSubscription])
        )
        mockDugsiStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([])
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([
          createMockStudent('MAHAD_PROGRAM', {
            stripeSubscriptionId: MOCK_IDS.subscription,
          }),
        ] as unknown)

        const result = await getOrphanedSubscriptions()

        expect(result).toHaveLength(0)
      })

      it('should handle customer as string ID', async () => {
        const mockSubscription = createMockStripeSubscription({
          customer: MOCK_IDS.customer,
        })

        mockMahadStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([mockSubscription])
        )
        mockDugsiStripeClient.subscriptions.list.mockResolvedValue(
          createPaginatedStripeResponse([])
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([])

        const result = await getOrphanedSubscriptions()

        expect(result).toHaveLength(1)
        expect(result[0].customerId).toBe(MOCK_IDS.customer)
        expect(result[0].customerEmail).toBeNull()
      })
    })

    describe('Error Cases', () => {
      it('should throw error when STRIPE_SECRET_KEY_PROD is missing', async () => {
        delete process.env.STRIPE_SECRET_KEY_PROD

        await expect(getOrphanedSubscriptions()).rejects.toThrow(
          'STRIPE_SECRET_KEY_PROD is not defined'
        )
      })
    })
  })

  describe('searchStudents', () => {
    describe('Search Functionality', () => {
      it('should search students by name', async () => {
        const mockStudents = [
          createMockStudent('MAHAD_PROGRAM', {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '1234567890',
          }),
        ]

        vi.mocked(prisma.student.findMany).mockResolvedValue(
          mockStudents as unknown
        )

        const result = await searchStudents('john')

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('John Doe')
      })

      it('should filter by Mahad program', async () => {
        const mockStudents = [createMockStudent('MAHAD_PROGRAM')]

        vi.mocked(prisma.student.findMany).mockResolvedValue(
          mockStudents as unknown
        )

        await searchStudents('test', 'MAHAD')

        expect(prisma.student.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              program: 'MAHAD_PROGRAM',
            }),
          })
        )
      })

      it('should correctly set hasSubscription flag', async () => {
        const mockStudents = [
          createMockStudent('MAHAD_PROGRAM', {
            stripeSubscriptionId: 'sub_123',
          }),
        ]

        vi.mocked(prisma.student.findMany).mockResolvedValue(
          mockStudents as unknown
        )

        const result = await searchStudents('test', 'MAHAD')

        expect(result[0].hasSubscription).toBe(true)
      })
    })

    describe('Edge Cases', () => {
      it('should return empty array when no matches found', async () => {
        vi.mocked(prisma.student.findMany).mockResolvedValue([])

        const result = await searchStudents('nonexistent')

        expect(result).toHaveLength(0)
      })
    })
  })

  describe('getPotentialMatches', () => {
    it('should find students by email', async () => {
      const mockStudents = [
        createMockStudent('MAHAD_PROGRAM', {
          email: 'test@example.com',
        }),
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(
        mockStudents as unknown
      )

      const result = await getPotentialMatches('test@example.com', 'MAHAD')

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe('test@example.com')
    })

    it('should return empty array when email is null', async () => {
      const result = await getPotentialMatches(null, 'MAHAD')

      expect(result).toHaveLength(0)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
    })
  })

  describe('linkSubscriptionToStudent - Mahad Program', () => {
    describe('Basic Linking', () => {
      it('should successfully link subscription to Mahad student', async () => {
        const { revalidatePath } = await import('next/cache')
        const mockStudent = createMockStudent('MAHAD_PROGRAM')
        const mockSubscription = createMockStripeSubscription()

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockMahadStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'MAHAD'
        )

        expect(result).toEqual({ success: true })
        expect(revalidatePath).toHaveBeenCalledWith('/admin/link-subscriptions')
      })

      it('should update subscription fields', async () => {
        const mockStudent = createMockStudent('MAHAD_PROGRAM')
        const mockSubscription = createMockStripeSubscription()

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockMahadStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'MAHAD'
        )

        expect(prisma.student.update).toHaveBeenCalledWith({
          where: { id: MOCK_IDS.student },
          data: expect.objectContaining({
            stripeSubscriptionId: MOCK_IDS.subscription,
            stripeCustomerId: MOCK_IDS.customer,
            subscriptionStatus: 'active',
          }),
        })
      })

      it('should track subscription history', async () => {
        const mockStudent = createMockStudent('MAHAD_PROGRAM', {
          stripeSubscriptionId: 'sub_old123',
        })
        const mockSubscription = createMockStripeSubscription({
          id: 'sub_new123',
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockMahadStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        await linkSubscriptionToStudent('sub_new123', MOCK_IDS.student, 'MAHAD')

        expect(prisma.student.update).toHaveBeenCalledWith({
          where: { id: MOCK_IDS.student },
          data: expect.objectContaining({
            previousSubscriptionIds: {
              push: 'sub_old123',
            },
          }),
        })
      })
    })

    describe('Error Cases', () => {
      it('should return error when student not found', async () => {
        vi.mocked(prisma.student.findFirst).mockResolvedValue(null)

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'MAHAD'
        )

        expect(result).toEqual({
          success: false,
          error: 'Student not found or not in Mahad program',
        })
      })

      it('should return error when customer ID is invalid', async () => {
        const mockStudent = createMockStudent('MAHAD_PROGRAM')
        const mockSubscription = createMockStripeSubscription({
          customer: null as unknown,
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockMahadStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'MAHAD'
        )

        expect(result).toEqual({
          success: false,
          error: 'Invalid customer ID in subscription',
        })
      })
    })
  })

  describe('linkSubscriptionToStudent - Dugsi Program', () => {
    describe('Family Linking', () => {
      it('should successfully link subscription to Dugsi student', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: 'parent@example.com',
        })
        const mockSubscription = createMockStripeSubscription()

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockDugsiStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([
          mockStudent,
        ] as unknown)
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result).toEqual({ success: true })
      })

      it('should update all family members', async () => {
        const familyEmail = 'family@example.com'
        const mockFamily = [
          createMockStudent('DUGSI_PROGRAM', {
            id: 'student_1',
            parentEmail: familyEmail,
          }),
          createMockStudent('DUGSI_PROGRAM', {
            id: 'student_2',
            parentEmail: familyEmail,
          }),
        ]

        const mockSubscription = createMockStripeSubscription()

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockFamily[0] as unknown
        )
        mockDugsiStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue(
          mockFamily as unknown
        )
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          'student_1',
          'DUGSI'
        )

        expect(prisma.student.update).toHaveBeenCalledTimes(2)
      })

      it('should use Dugsi Stripe client', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: 'test@example.com',
        })
        const mockSubscription = createMockStripeSubscription()

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockDugsiStripeClient.subscriptions.retrieve.mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([
          mockStudent,
        ] as unknown)
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(getDugsiStripeClient).toHaveBeenCalled()
        expect(
          mockDugsiStripeClient.subscriptions.retrieve
        ).toHaveBeenCalledWith(MOCK_IDS.subscription)
      })
    })

    describe('Email Validation (P1 Bug Fix)', () => {
      it('should return error when parentEmail is null', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: null,
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result).toEqual({
          success: false,
          error:
            'Parent email is required to link subscription. Please update the student record with a parent email first.',
        })
        expect(
          mockDugsiStripeClient.subscriptions.retrieve
        ).not.toHaveBeenCalled()
      })

      it('should return error when parentEmail is empty string', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: '',
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Parent email is required')
      })

      it('should return error when parentEmail is whitespace only', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: '   ',
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Parent email is required')
      })
    })

    describe('Error Cases', () => {
      it('should return error when student not found', async () => {
        vi.mocked(prisma.student.findFirst).mockResolvedValue(null)

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result).toEqual({
          success: false,
          error: 'Student not found or not in Dugsi program',
        })
      })

      it('should return error when subscription not found in Stripe', async () => {
        const mockStudent = createMockStudent('DUGSI_PROGRAM', {
          parentEmail: 'test@example.com',
        })

        vi.mocked(prisma.student.findFirst).mockResolvedValue(
          mockStudent as unknown
        )
        mockDugsiStripeClient.subscriptions.retrieve.mockRejectedValue(
          new Error('No such subscription')
        )

        const result = await linkSubscriptionToStudent(
          MOCK_IDS.subscription,
          MOCK_IDS.student,
          'DUGSI'
        )

        expect(result).toEqual({
          success: false,
          error: 'No such subscription',
        })
      })
    })
  })

  describe('linkSubscriptionToStudent - Invalid Program', () => {
    it('should return error for invalid program', async () => {
      const mockStudent = createMockStudent('MAHAD_PROGRAM')

      vi.mocked(prisma.student.findFirst).mockResolvedValue(
        mockStudent as unknown
      )

      const result = await linkSubscriptionToStudent(
        MOCK_IDS.subscription,
        MOCK_IDS.student,
        'INVALID' as unknown
      )

      expect(result).toEqual({
        success: false,
        error: 'Invalid program specified',
      })
    })
  })
})
