import { DonationStatus } from '@prisma/client'
import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockDonationUpsert,
  mockDonationFindUnique,
  mockDonationFindFirst,
  mockDonationUpdate,
  mockDonationUpdateMany,
  mockDonationDeleteMany,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockLoggerDebug,
  mockLogError,
} = vi.hoisted(() => ({
  mockDonationUpsert: vi.fn(),
  mockDonationFindUnique: vi.fn(),
  mockDonationFindFirst: vi.fn(),
  mockDonationUpdate: vi.fn(),
  mockDonationUpdateMany: vi.fn(),
  mockDonationDeleteMany: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(
      async (fn: (tx: { donation: Record<string, unknown> }) => unknown) =>
        fn({
          donation: {
            findFirst: (...args: unknown[]) => mockDonationFindFirst(...args),
            upsert: (...args: unknown[]) => mockDonationUpsert(...args),
            updateMany: (...args: unknown[]) => mockDonationUpdateMany(...args),
          },
        })
    ),
    donation: {
      upsert: (...args: unknown[]) => mockDonationUpsert(...args),
      findUnique: (...args: unknown[]) => mockDonationFindUnique(...args),
      findFirst: (...args: unknown[]) => mockDonationFindFirst(...args),
      update: (...args: unknown[]) => mockDonationUpdate(...args),
      updateMany: (...args: unknown[]) => mockDonationUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockDonationDeleteMany(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractCustomerId: (customer: unknown) => {
    if (typeof customer === 'string') return customer
    if (customer && typeof customer === 'object' && 'id' in customer)
      return (customer as { id: string }).id
    return null
  },
}))

import {
  handleOneTimeDonation,
  handleRecurringDonationCheckout,
  handleDonationPaymentIntentSucceeded,
  handleDonationInvoicePaid,
  handleDonationInvoiceFinalized,
  handleDonationSubscriptionCreated,
  handleDonationSubscriptionUpdated,
  handleDonationSubscriptionDeleted,
} from '../donation-handler'

function createMockSession(overrides = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    payment_intent: 'pi_test_123',
    subscription: null,
    customer: 'cus_test_123',
    amount_total: 5000,
    currency: 'usd',
    mode: 'payment',
    customer_details: {
      email: 'donor@example.com',
      name: 'John Doe',
    },
    metadata: {
      source: 'donation_page',
      isAnonymous: 'false',
      donorName: 'John Doe',
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

function createMockEvent(type: string, data: unknown): Stripe.Event {
  return {
    id: 'evt_test_123',
    type,
    data: { object: data },
  } as Stripe.Event
}

function createMockInvoice(overrides = {}) {
  return {
    id: 'in_test_123',
    subscription: 'sub_test_456',
    payment_intent: 'pi_test_789',
    customer: 'cus_test_123',
    amount_paid: 2500,
    currency: 'usd',
    customer_email: 'donor@example.com',
    ...overrides,
  }
}

describe('donation-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDonationUpsert.mockResolvedValue({})
    mockDonationFindUnique.mockResolvedValue(null)
    mockDonationFindFirst.mockResolvedValue(null)
    mockDonationUpdate.mockResolvedValue({})
    mockDonationUpdateMany.mockResolvedValue({ count: 0 })
    mockDonationDeleteMany.mockResolvedValue({ count: 0 })
  })

  describe('handleOneTimeDonation', () => {
    it('records one-time donation with correct fields', async () => {
      const session = createMockSession()

      await handleOneTimeDonation(session)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'pi_test_123' },
          create: expect.objectContaining({
            stripePaymentIntentId: 'pi_test_123',
            stripeCustomerId: 'cus_test_123',
            amount: 5000,
            currency: 'usd',
            status: DonationStatus.succeeded,
            donorName: 'John Doe',
            donorEmail: 'donor@example.com',
            isAnonymous: false,
            isRecurring: false,
          }),
          update: expect.objectContaining({
            status: DonationStatus.succeeded,
          }),
        })
      )
    })

    it('throws if payment_intent is missing on session', async () => {
      const session = createMockSession({
        payment_intent: null,
      })

      await expect(handleOneTimeDonation(session)).rejects.toThrow(
        'Missing payment_intent on checkout session'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })

    it('throws on null amount_total', async () => {
      const session = createMockSession({ amount_total: null })

      await expect(handleOneTimeDonation(session)).rejects.toThrow(
        'Donation amount_total is'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })

    it('throws on zero amount_total', async () => {
      const session = createMockSession({ amount_total: 0 })

      await expect(handleOneTimeDonation(session)).rejects.toThrow(
        'Donation amount_total is'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })

    it('sets donorName to null when isAnonymous is true', async () => {
      const session = createMockSession({
        metadata: {
          source: 'donation_page',
          isAnonymous: 'true',
          donorName: 'John Doe',
        },
      })

      await handleOneTimeDonation(session)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            donorName: null,
            isAnonymous: true,
          }),
        })
      )
    })
  })

  describe('handleRecurringDonationCheckout', () => {
    it('creates pending placeholder with sub_setup_ prefix', async () => {
      const session = createMockSession({
        subscription: 'sub_test_456',
        mode: 'subscription',
      })

      await handleRecurringDonationCheckout(session)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'sub_setup_sub_test_456' },
          create: expect.objectContaining({
            stripePaymentIntentId: 'sub_setup_sub_test_456',
            status: DonationStatus.pending,
            isRecurring: true,
            stripeSubscriptionId: 'sub_test_456',
          }),
        })
      )
    })

    it('throws on null amount_total', async () => {
      const session = createMockSession({
        subscription: 'sub_test_456',
        mode: 'subscription',
        amount_total: null,
      })

      await expect(handleRecurringDonationCheckout(session)).rejects.toThrow(
        'Donation amount_total is'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })

    it('throws on zero amount_total', async () => {
      const session = createMockSession({
        subscription: 'sub_test_456',
        mode: 'subscription',
        amount_total: 0,
      })

      await expect(handleRecurringDonationCheckout(session)).rejects.toThrow(
        'Donation amount_total is'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })

    it('throws if subscription is missing', async () => {
      const session = createMockSession({
        subscription: null,
      })

      await expect(handleRecurringDonationCheckout(session)).rejects.toThrow(
        'Missing subscription on checkout session'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })
  })

  describe('handleDonationPaymentIntentSucceeded', () => {
    it('updates existing donation to succeeded', async () => {
      mockDonationFindUnique.mockResolvedValue({
        id: 'don_1',
        stripePaymentIntentId: 'pi_test_123',
        status: DonationStatus.pending,
      })

      const event = createMockEvent('payment_intent.succeeded', {
        id: 'pi_test_123',
        amount: 5000,
      })

      await handleDonationPaymentIntentSucceeded(event)

      expect(mockDonationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'pi_test_123' },
          data: expect.objectContaining({
            status: DonationStatus.succeeded,
            amount: 5000,
          }),
        })
      )
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: 'pi_test_123' }),
        'Donation payment confirmed'
      )
    })

    it('logs and skips when donation not found', async () => {
      mockDonationFindUnique.mockResolvedValue(null)

      const event = createMockEvent('payment_intent.succeeded', {
        id: 'pi_test_999',
        amount: 3000,
      })

      await handleDonationPaymentIntentSucceeded(event)

      expect(mockDonationUpdate).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: 'pi_test_999' }),
        'Payment intent not found in donations - may be handled by checkout.session.completed'
      )
    })

    it('propagates DB errors', async () => {
      mockDonationFindUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      const event = createMockEvent('payment_intent.succeeded', {
        id: 'pi_test_123',
        amount: 5000,
      })

      await expect(handleDonationPaymentIntentSucceeded(event)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('handleDonationInvoicePaid', () => {
    it('creates succeeded donation for recurring payment', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice()
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'pi_test_789' },
          create: expect.objectContaining({
            stripePaymentIntentId: 'pi_test_789',
            stripeCustomerId: 'cus_test_123',
            amount: 2500,
            currency: 'usd',
            status: DonationStatus.succeeded,
            isRecurring: true,
            stripeSubscriptionId: 'sub_test_456',
          }),
        })
      )
    })

    it('cleans up placeholder by deleting sub_setup_ record', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ customer_email: null })
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationDeleteMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'sub_setup_sub_test_456' },
      })
    })

    it('skips when no subscriptionId', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ subscription: null })
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'in_test_123' }),
        'Invoice has no subscription or payment_intent -- skipping'
      )
    })

    it('skips when no payment_intent', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ payment_intent: null })
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'in_test_123' }),
        'Invoice has no subscription or payment_intent -- skipping'
      )
    })

    it('skips $0 invoice with warn log', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ amount_paid: 0 })
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'in_test_123',
          subscriptionId: 'sub_test_456',
          amount_paid: 0,
        }),
        'Skipping $0 invoice -- coupon, credit, or trial end'
      )
    })

    it('skips null amount_paid invoice', async () => {
      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ amount_paid: null })
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockLoggerWarn).toHaveBeenCalled()
    })

    it('inherits isAnonymous and donorName from checkout placeholder', async () => {
      mockDonationFindFirst.mockResolvedValue({
        isAnonymous: true,
        donorName: null,
      })

      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice()
      )

      await handleDonationInvoicePaid(event)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isAnonymous: true,
            donorName: null,
          }),
        })
      )
    })

    it('handles placeholder cleanup failure gracefully', async () => {
      const cleanupError = new Error('Cleanup failed')
      mockDonationDeleteMany.mockRejectedValue(cleanupError)

      const event = createMockEvent(
        'invoice.payment_succeeded',
        createMockInvoice({ customer_email: null })
      )

      await expect(handleDonationInvoicePaid(event)).resolves.toBeUndefined()

      expect(mockLogError).toHaveBeenCalledWith(
        expect.anything(),
        cleanupError,
        'Failed to clean up donation placeholder',
        expect.objectContaining({
          placeholderId: 'sub_setup_sub_test_456',
          subscriptionId: 'sub_test_456',
        })
      )
    })
  })

  describe('handleDonationInvoiceFinalized', () => {
    it('logs without DB writes', async () => {
      const event = createMockEvent('invoice.finalized', { id: 'in_test_123' })

      await handleDonationInvoiceFinalized(event)

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'in_test_123' }),
        'Donation invoice finalized -- no action needed'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
    })
  })

  describe('handleDonationSubscriptionCreated', () => {
    it('logs subscription info without DB writes', async () => {
      const event = createMockEvent('customer.subscription.created', {
        id: 'sub_test_456',
        customer: 'cus_test_123',
        status: 'active',
      })

      await handleDonationSubscriptionCreated(event)

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub_test_456',
          customerId: 'cus_test_123',
          status: 'active',
        }),
        'Donation subscription created -- tracking via Donation records only'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockDonationUpdate).not.toHaveBeenCalled()
    })
  })

  describe('handleDonationSubscriptionUpdated', () => {
    it('logs subscription update without DB writes', async () => {
      const event = createMockEvent('customer.subscription.updated', {
        id: 'sub_test_456',
        status: 'past_due',
      })

      await handleDonationSubscriptionUpdated(event)

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub_test_456',
          status: 'past_due',
        }),
        'Donation subscription updated'
      )
      expect(mockDonationUpsert).not.toHaveBeenCalled()
      expect(mockDonationUpdate).not.toHaveBeenCalled()
    })
  })

  describe('handleDonationSubscriptionDeleted', () => {
    const deletedSubscription = {
      id: 'sub_test_456',
      customer: 'cus_test_123',
      status: 'canceled',
    }

    it('creates cancellation marker with sub_cancelled_ prefix', async () => {
      const event = createMockEvent(
        'customer.subscription.deleted',
        deletedSubscription
      )

      await handleDonationSubscriptionDeleted(event)

      expect(mockDonationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            stripePaymentIntentId: 'sub_cancelled_sub_test_456',
          },
          create: expect.objectContaining({
            stripePaymentIntentId: 'sub_cancelled_sub_test_456',
            stripeSubscriptionId: 'sub_test_456',
            stripeCustomerId: 'cus_test_123',
            amount: 0,
            status: DonationStatus.cancelled,
            isRecurring: true,
          }),
          update: {
            status: DonationStatus.cancelled,
          },
        })
      )
    })

    it('propagates DB errors', async () => {
      mockDonationUpsert.mockRejectedValue(new Error('DB write failed'))

      const event = createMockEvent(
        'customer.subscription.deleted',
        deletedSubscription
      )

      await expect(handleDonationSubscriptionDeleted(event)).rejects.toThrow(
        'DB write failed'
      )
    })
  })
})
