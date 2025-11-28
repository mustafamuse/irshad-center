/**
 * Mahad Checkout Session API Route Tests
 *
 * Tests for creating Stripe Checkout Sessions with dynamically calculated pricing.
 */

import { vi, describe, it, expect, beforeEach, Mock } from 'vitest'

// ============================================================================
// Mocks (must be before imports)
// ============================================================================

const mockStripeCreate = vi.fn()
vi.mock('@/lib/stripe-mahad', () => ({
  getMahadStripeClient: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockStripeCreate,
      },
    },
  })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    billingAccount: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { prisma } from '@/lib/db'

import { POST } from '../route'

// ============================================================================
// Test Utilities
// ============================================================================

type MockedPrisma = {
  programProfile: {
    findUnique: Mock
    update: Mock
  }
  billingAccount: {
    findFirst: Mock
  }
}

const mockedPrisma = prisma as unknown as MockedPrisma

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/mahad/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-123',
    personId: 'person-456',
    program: 'MAHAD_PROGRAM',
    person: {
      name: 'Test Student',
      contactPoints: [{ value: 'test@example.com', type: 'EMAIL' }],
    },
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/mahad/create-checkout-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.STRIPE_MAHAD_PRODUCT_ID = 'prod_test123'
  })

  describe('Validation', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await POST(createRequest({ profileId: 'profile-123' }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 400 for missing profileId', async () => {
      const response = await POST(
        createRequest({
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 400 for EXEMPT billing type', async () => {
      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'EXEMPT',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Exempt students do not need to set up payment')
    })
  })

  describe('Profile Not Found', () => {
    it('should return 404 for non-existent profile', async () => {
      mockedPrisma.programProfile.findUnique.mockResolvedValue(null)

      const response = await POST(
        createRequest({
          profileId: 'non-existent',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Student profile not found')
    })
  })

  describe('Successful Checkout Creation', () => {
    it('should create checkout session with correct rate for NON_GRADUATE + MONTHLY + FULL_TIME', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.sessionId).toBe('cs_test_123')
      expect(data.url).toContain('stripe.com')

      // Verify Stripe was called with correct amount ($120 = 12000 cents)
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: expect.objectContaining({
                unit_amount: 12000,
                currency: 'usd',
                recurring: { interval: 'month', interval_count: 1 },
              }),
              quantity: 1,
            },
          ],
        })
      )
    })

    it('should create checkout session with correct rate for GRADUATE + MONTHLY + FULL_TIME', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      })

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(200)

      // Verify Stripe was called with correct amount ($95 = 9500 cents)
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: expect.objectContaining({
                unit_amount: 9500,
              }),
              quantity: 1,
            },
          ],
        })
      )
    })

    it('should create checkout session with correct rate for BI_MONTHLY', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_789',
        url: 'https://checkout.stripe.com/pay/cs_test_789',
      })

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'BI_MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(200)

      // Verify Stripe was called with correct amount ($220 = 22000 cents) and 2-month interval
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: expect.objectContaining({
                unit_amount: 22000,
                recurring: { interval: 'month', interval_count: 2 },
              }),
              quantity: 1,
            },
          ],
        })
      )
    })

    it('should create checkout session with scholarship discount', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_schol',
        url: 'https://checkout.stripe.com/pay/cs_test_schol',
      })

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME_SCHOLARSHIP',
        })
      )

      expect(response.status).toBe(200)

      // Verify Stripe was called with scholarship rate ($120 - $30 = $90 = 9000 cents)
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: expect.objectContaining({
                unit_amount: 9000,
              }),
              quantity: 1,
            },
          ],
        })
      )
    })

    it('should create checkout session with part-time rate', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_part',
        url: 'https://checkout.stripe.com/pay/cs_test_part',
      })

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'PART_TIME',
        })
      )

      expect(response.status).toBe(200)

      // Verify Stripe was called with part-time rate ($120 / 2 = $60 = 6000 cents)
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: expect.objectContaining({
                unit_amount: 6000,
              }),
              quantity: 1,
            },
          ],
        })
      )
    })
  })

  describe('Metadata', () => {
    it('should include billing metadata in subscription_data', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_meta',
        url: 'https://checkout.stripe.com/pay/cs_test_meta',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: {
            metadata: expect.objectContaining({
              profileId: 'profile-123',
              personId: 'person-456',
              studentName: 'Test Student',
              graduationStatus: 'NON_GRADUATE',
              paymentFrequency: 'MONTHLY',
              billingType: 'FULL_TIME',
              calculatedRate: '12000',
            }),
          },
        })
      )
    })

    it('should include session metadata', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_session_meta',
        url: 'https://checkout.stripe.com/pay/cs_test_session_meta',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            profileId: 'profile-123',
            personId: 'person-456',
            studentName: 'Test Student',
            source: 'mahad-registration',
          }),
        })
      )
    })
  })

  describe('Profile Update', () => {
    it('should update profile with billing configuration after checkout creation', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_update',
        url: 'https://checkout.stripe.com/pay/cs_test_update',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'GRADUATE',
          paymentFrequency: 'BI_MONTHLY',
          billingType: 'PART_TIME',
        })
      )

      expect(prisma.programProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-123' },
        data: {
          graduationStatus: 'GRADUATE',
          paymentFrequency: 'BI_MONTHLY',
          billingType: 'PART_TIME',
        },
      })
    })
  })

  describe('Existing Customer', () => {
    it('should use existing Stripe customer ID if billing account exists', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue({
        stripeCustomerIdMahad: 'cus_existing123',
      })
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_existing',
        url: 'https://checkout.stripe.com/pay/cs_test_existing',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing123',
          customer_email: undefined,
        })
      )
    })

    it('should use customer_email if no existing customer', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_new_cust',
        url: 'https://checkout.stripe.com/pay/cs_test_new_cust',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: undefined,
          customer_email: 'test@example.com',
        })
      )
    })
  })

  describe('Success and Cancel URLs', () => {
    it('should use default URLs when not provided', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_urls',
        url: 'https://checkout.stripe.com/pay/cs_test_urls',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/mahad/register?success=true',
          cancel_url: 'http://localhost:3000/mahad/register?canceled=true',
        })
      )
    })

    it('should use custom URLs when provided', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_custom_urls',
        url: 'https://checkout.stripe.com/pay/cs_test_custom_urls',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
          successUrl: 'http://custom.com/success',
          cancelUrl: 'http://custom.com/cancel',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://custom.com/success',
          cancel_url: 'http://custom.com/cancel',
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should return 500 when Stripe fails', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockStripeCreate.mockRejectedValue(new Error('Stripe API error'))

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to create checkout session')
    })

    it('should return 500 when database query fails', async () => {
      mockedPrisma.programProfile.findUnique.mockRejectedValue(
        new Error('Database error')
      )

      const response = await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(response.status).toBe(500)
    })
  })

  describe('Payment Methods', () => {
    it('should allow card and ACH payment methods', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_payment_methods',
        url: 'https://checkout.stripe.com/pay/cs_test_payment_methods',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card', 'us_bank_account'],
        })
      )
    })

    it('should enable promotion codes', async () => {
      const mockProfile = createMockProfile()
      mockedPrisma.programProfile.findUnique.mockResolvedValue(mockProfile)
      mockedPrisma.billingAccount.findFirst.mockResolvedValue(null)
      mockedPrisma.programProfile.update.mockResolvedValue(mockProfile)
      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_promo',
        url: 'https://checkout.stripe.com/pay/cs_test_promo',
      })

      await POST(
        createRequest({
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
        })
      )

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_promotion_codes: true,
        })
      )
    })
  })
})
