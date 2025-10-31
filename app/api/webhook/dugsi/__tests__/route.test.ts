/**
 * Dugsi Webhook Handler Tests
 *
 * Comprehensive test suite for the Dugsi webhook handler
 * ensuring proper payment method capture, subscription management,
 * and error handling.
 */

import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { prisma } from '@/lib/db'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

import { POST } from '../route'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test_signature'),
  }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}))

vi.mock('@/lib/db', () => {
  const mockStudent = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  }

  return {
    prisma: {
      student: mockStudent,
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        const tx = { student: mockStudent }
        return callback(tx)
      }),
    },
  }
})

vi.mock('@/lib/stripe-dugsi', () => ({
  verifyDugsiWebhook: vi.fn(),
}))

vi.mock('@/lib/utils/dugsi-payment', () => ({
  parseDugsiReferenceId: vi.fn().mockReturnValue({
    familyId: 'test_family_123',
    childCount: 2,
  }),
}))

// ============================================================================
// Test Constants
// ============================================================================

const TEST_CONSTANTS = {
  EVENT_IDS: {
    TEST: 'evt_test',
    DUPLICATE: 'evt_duplicate',
    NEW: 'evt_new',
    PAYMENT: 'evt_payment',
    NO_REF: 'evt_no_ref',
    NO_CUSTOMER: 'evt_no_customer',
    SUB_CREATED: 'evt_sub_created',
    SUB_UPDATED: 'evt_sub_updated',
    SUB_CANCELED: 'evt_sub_canceled',
    INVALID_STATUS: 'evt_invalid_status',
    DB_ERROR: 'evt_db_error',
    NO_STUDENTS: 'evt_no_students',
    UNHANDLED: 'evt_unhandled',
    CUSTOMER_OBJECT: 'evt_customer_object',
    NO_PERIOD_END: 'evt_no_period_end',
  },
  CUSTOMER: {
    ID: 'cus_test123',
    EMAIL: 'test@example.com',
    PARENT_EMAIL: 'parent@example.com',
  },
  SUBSCRIPTION: {
    ID: 'sub_test123',
  },
  FAMILY: {
    ID: 'test_family_123',
    REFERENCE_ID: 'dugsi_test_family_123_2kids',
    CHILD_COUNT: 2,
  },
  CHECKOUT: {
    SESSION_ID: 'cs_test',
  },
} as const

// ============================================================================
// Test Utilities & Factories
// ============================================================================

/**
 * Helper to safely extract response body from NextResponse mock
 */
function getResponseBody(response: { body: unknown; status: number }) {
  return response.body as Record<string, unknown>
}

/**
 * Create a base Stripe Event with common defaults
 */
function createBaseEvent(overrides?: Partial<Stripe.Event>): Stripe.Event {
  return {
    id: TEST_CONSTANTS.EVENT_IDS.TEST,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Date.now(),
    data: {
      object: {} as Stripe.Checkout.Session,
      previous_attributes: null as unknown as
        | Record<string, unknown>
        | undefined,
    },
    livemode: true,
    pending_webhooks: 1,
    request: null,
    type: 'checkout.session.completed',
    ...overrides,
  } as Stripe.Event
}

/**
 * Create a Stripe Event for checkout.session.completed
 */
function createCheckoutEvent(
  session: Partial<Stripe.Checkout.Session> = {},
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
  const checkoutSession = {
    id: TEST_CONSTANTS.CHECKOUT.SESSION_ID,
    client_reference_id: TEST_CONSTANTS.FAMILY.REFERENCE_ID,
    customer: TEST_CONSTANTS.CUSTOMER.ID,
    customer_email: TEST_CONSTANTS.CUSTOMER.EMAIL,
    ...session,
    // Explicitly handle null values by converting to undefined
    ...(session.client_reference_id === null
      ? { client_reference_id: undefined }
      : {}),
    ...(session.customer === null ? { customer: undefined } : {}),
  } as Stripe.Checkout.Session

  return {
    ...createBaseEvent(),
    type: 'checkout.session.completed',
    data: {
      object: checkoutSession,
      previous_attributes: null as unknown as
        | Record<string, unknown>
        | undefined,
    } as Stripe.Event.Data<Stripe.Checkout.Session>,
    ...overrides,
  } as Stripe.Event
}

/**
 * Create a Stripe Subscription object
 */
function createSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: TEST_CONSTANTS.SUBSCRIPTION.ID,
    object: 'subscription',
    customer: TEST_CONSTANTS.CUSTOMER.ID,
    status: 'active',
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    ...overrides,
  } as Stripe.Subscription
}

/**
 * Create a Stripe Event for subscription events
 */
function createSubscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  subscription: Partial<Stripe.Subscription> = {},
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
  const subscriptionObj = createSubscription(subscription)

  return {
    ...createBaseEvent(),
    type,
    data: {
      object: subscriptionObj,
      previous_attributes:
        type === 'customer.subscription.updated'
          ? { status: 'active' }
          : undefined,
    } as Stripe.Event.Data<Stripe.Subscription>,
    ...overrides,
  } as Stripe.Event
}

/**
 * Create a test request with proper Stripe webhook payload
 */
function createTestRequest(
  event: Stripe.Event | null = null,
  options: {
    signature?: string | null
    rawBody?: string
  } = {}
): Request {
  const rawBody = options.rawBody ?? (event ? JSON.stringify(event) : '{}')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.signature !== undefined) {
    if (options.signature !== null) {
      headers['stripe-signature'] = options.signature
    }
  } else {
    headers['stripe-signature'] = 'test_signature'
  }

  return new Request('http://localhost/api/webhook/dugsi', {
    method: 'POST',
    body: rawBody,
    headers,
  })
}

// ============================================================================
// Mock Setup Helpers
// ============================================================================

/**
 * Setup headers mock with specific signature
 */
async function setupHeadersMock(signature: string | null = 'test_signature') {
  const headers = await import('next/headers')
  vi.mocked(headers.headers).mockResolvedValue({
    get: vi.fn().mockReturnValue(signature),
  } as Headers)
}

/**
 * Setup webhook verification and event state in one call
 */
function setupWebhookMocks(
  event: Stripe.Event,
  options: {
    isProcessed?: boolean
    verificationError?: Error
  } = {}
) {
  if (options.verificationError) {
    vi.mocked(verifyDugsiWebhook).mockImplementationOnce(() => {
      throw options.verificationError
    })
  } else {
    vi.mocked(verifyDugsiWebhook).mockReturnValue(event)
  }

  if (options.isProcessed) {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: '1',
      eventId: event.id,
      eventType: event.type,
      source: 'dugsi',
      payload: {},
      createdAt: new Date(),
    } as any)
  } else {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
  }
}

/**
 * Create a transaction mock for payment method capture
 */
function createPaymentMethodTransactionMock(updateCount: number = 2) {
  return vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
    const tx = {
      student: {
        updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
      },
    }
    return await fn(tx as Parameters<typeof fn>[0])
  })
}

/**
 * Create a transaction mock for subscription events
 */
function createSubscriptionTransactionMock(
  students: Array<{
    id: string
    name?: string
    subscriptionStatus?: string | null
  }> = [{ id: '1', name: 'Child 1' }],
  updateCount?: number
) {
  const count = updateCount ?? students.length
  let capturedUpdateData: Record<string, unknown> | undefined

  vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
    const tx = {
      student: {
        findMany: vi.fn().mockResolvedValue(students),
        update: vi
          .fn()
          .mockImplementation(
            (args: {
              where: { id: string }
              data: Record<string, unknown>
            }) => {
              capturedUpdateData = args.data
              return Promise.resolve({} as any)
            }
          ),
        updateMany: vi.fn().mockResolvedValue({ count }),
      },
    }
    return await fn(tx as Parameters<typeof fn>[0])
  })

  return {
    getCapturedData: () => capturedUpdateData,
  }
}

/**
 * Create a transaction mock that captures update data
 */
function createCapturingTransactionMock(
  students: Array<{ id: string; name?: string }> = [
    { id: '1', name: 'Child 1' },
  ]
) {
  let capturedUpdateData: Record<string, unknown> | undefined

  vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
    const tx = {
      student: {
        findMany: vi.fn().mockResolvedValue(students),
        update: vi
          .fn()
          .mockImplementation(
            (args: {
              where: { id: string }
              data: Record<string, unknown>
            }) => {
              capturedUpdateData = args.data
              return Promise.resolve({} as any)
            }
          ),
        updateMany: vi
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedUpdateData = args.data
            return Promise.resolve({ count: 1 })
          }),
      },
    }
    return await fn(tx as Parameters<typeof fn>[0])
  })

  return {
    getCapturedData: () => capturedUpdateData,
  }
}

/**
 * Create a transaction mock that throws an error
 */
function createFailingTransactionMock(error: Error) {
  return vi.mocked(prisma.$transaction).mockRejectedValueOnce(error)
}

/**
 * Setup default webhook event mocks
 */
function setupDefaultWebhookMocks() {
  vi.mocked(prisma.webhookEvent.create).mockResolvedValue({
    id: '1',
    eventId: TEST_CONSTANTS.EVENT_IDS.TEST,
    eventType: 'test',
    source: 'dugsi',
    payload: {},
    createdAt: new Date(),
  } as any)

  vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)

  vi.mocked(prisma.webhookEvent.delete).mockResolvedValue({
    id: '1',
    eventId: TEST_CONSTANTS.EVENT_IDS.TEST,
    eventType: 'test',
    source: 'dugsi',
    payload: {},
    createdAt: new Date(),
  } as any)
}

// ============================================================================
// Test Runner Helpers
// ============================================================================

/**
 * Helper to run a webhook test with common setup
 */
async function runWebhookTest(options: {
  event: Stripe.Event | null
  setupMocks?: () => void | Promise<void>
  expectedStatus: number
  expectedBody?: Record<string, unknown>
  customAssertions?: (response: { body: unknown; status: number }) => void
  signature?: string | null
}) {
  // Setup headers if signature is provided
  if (options.signature !== undefined) {
    await setupHeadersMock(options.signature)
  }

  // Setup custom mocks if provided
  if (options.setupMocks) {
    await options.setupMocks()
  }

  const request = createTestRequest(options.event, {
    signature: options.signature,
  })
  const response = await POST(request)

  expect(response.status).toBe(options.expectedStatus)

  if (options.expectedBody) {
    expect(getResponseBody(response)).toEqual(options.expectedBody)
  }

  if (options.customAssertions) {
    options.customAssertions(response)
  }

  return response
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Dugsi Webhook Handler', () => {
  beforeEach(async () => {
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()

    await setupHeadersMock()
    setupDefaultWebhookMocks()
  })

  describe('Signature Verification', () => {
    it('should reject requests without signature', async () => {
      await runWebhookTest({
        event: null,
        signature: null,
        expectedStatus: 400,
        expectedBody: { message: 'Missing signature' },
      })
    })

    it('should reject requests with invalid signature', async () => {
      const mockEvent = createBaseEvent()

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          vi.mocked(verifyDugsiWebhook).mockImplementationOnce(() => {
            throw new Error('Webhook verification failed: Invalid signature')
          })
        },
        expectedStatus: 401,
        expectedBody: { message: 'Invalid webhook signature' },
      })
    })
  })

  describe('Idempotency', () => {
    it('should skip already processed events', async () => {
      const mockEvent = createBaseEvent({
        id: TEST_CONSTANTS.EVENT_IDS.DUPLICATE,
      })

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent, { isProcessed: true })
        },
        expectedStatus: 200,
        expectedBody: { received: true, skipped: true },
        customAssertions: () => {
          expect(prisma.webhookEvent.create).not.toHaveBeenCalled()
        },
      })
    })

    it('should record new events to prevent duplicates', async () => {
      const mockEvent = createCheckoutEvent(
        {},
        {
          id: TEST_CONSTANTS.EVENT_IDS.NEW,
        }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createPaymentMethodTransactionMock()
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
            data: {
              eventId: TEST_CONSTANTS.EVENT_IDS.NEW,
              eventType: 'checkout.session.completed',
              source: 'dugsi',
              payload: mockEvent,
            },
          })
        },
      })
    })
  })

  describe('Payment Method Capture (checkout.session.completed)', () => {
    it('should update family students with payment method', async () => {
      const mockEvent = createCheckoutEvent(
        { customer_email: TEST_CONSTANTS.CUSTOMER.PARENT_EMAIL },
        { id: TEST_CONSTANTS.EVENT_IDS.PAYMENT }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createPaymentMethodTransactionMock(2)
        },
        expectedStatus: 200,
        expectedBody: { received: true },
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Updated 2 students')
          )
        },
      })
    })

    it('should handle missing client_reference_id', async () => {
      const mockEvent = createCheckoutEvent(
        { client_reference_id: null },
        { id: TEST_CONSTANTS.EVENT_IDS.NO_REF }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
        },
        expectedStatus: 200,
        customAssertions: (response) => {
          const body = getResponseBody(response)
          expect(body.warning).toContain('No client_reference_id')
        },
      })
    })

    it('should handle invalid customer ID', async () => {
      const mockEvent = createCheckoutEvent(
        { customer: undefined },
        { id: TEST_CONSTANTS.EVENT_IDS.NO_CUSTOMER }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
        },
        expectedStatus: 200,
        customAssertions: (response) => {
          const body = getResponseBody(response)
          expect(body.warning).toContain('Invalid or missing customer ID')
        },
      })
    })
  })

  describe('Subscription Events', () => {
    it('should handle subscription creation', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        { status: 'active' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CREATED }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createSubscriptionTransactionMock([
            { id: '1', name: 'Child 1' },
            { id: '2', name: 'Child 2' },
          ])
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining(
              `✅ Updated 2 students with subscription ${TEST_CONSTANTS.SUBSCRIPTION.ID}`
            )
          )
        },
      })
    })

    it('should handle subscription updates', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.updated',
        { status: 'past_due' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_UPDATED }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createSubscriptionTransactionMock([
            { id: '1', name: 'Child 1' },
            { id: '2', name: 'Child 2' },
          ])
        },
        expectedStatus: 200,
      })
    })

    it('should handle subscription cancellation', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.deleted',
        { status: 'canceled' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CANCELED }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          vi.mocked(prisma.student.findMany).mockResolvedValue([
            { id: '1', name: 'Child 1' },
            { id: '2', name: 'Child 2' },
          ] as any)
          vi.mocked(prisma.student.update).mockResolvedValue({} as any)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(prisma.student.findMany).toHaveBeenCalledWith({
            where: {
              stripeCustomerIdDugsi: TEST_CONSTANTS.CUSTOMER.ID,
              program: 'DUGSI_PROGRAM',
            },
          })
          expect(prisma.student.update).toHaveBeenCalledTimes(2)

          const updateCall = vi.mocked(prisma.student.update).mock.calls[0]
          expect(updateCall[0].data).toMatchObject({
            subscriptionStatus: 'canceled',
            status: 'withdrawn',
          })
        },
      })
    })

    it('should validate subscription status against enum', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        { status: 'invalid_status' as any },
        { id: TEST_CONSTANTS.EVENT_IDS.INVALID_STATUS }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createFailingTransactionMock(
            new Error('Invalid subscription status: invalid_status')
          )
        },
        expectedStatus: 500,
        customAssertions: () => {
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Dugsi Webhook Error')
          )
        },
      })
    })
  })

  describe('handleSubscriptionEvent - Period Fields', () => {
    it('should sync currentPeriodStart and currentPeriodEnd', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        {
          status: 'active',
          current_period_start: periodStartTimestamp,
          current_period_end: periodEndTimestamp,
        },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CREATED }
      )

      const mock = createSubscriptionTransactionMock(
        [{ id: '1', name: 'Child 1' }],
        1
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
        },
        expectedStatus: 200,
        customAssertions: () => {
          const capturedData = mock.getCapturedData()
          expect(capturedData).toMatchObject({
            subscriptionStatus: 'active',
            currentPeriodStart: expect.any(Date),
            currentPeriodEnd: expect.any(Date),
            paidUntil: expect.any(Date),
          })

          // Verify dates are correct
          const periodStart = (
            capturedData?.currentPeriodStart as Date
          )?.getTime()
          const periodEnd = (capturedData?.currentPeriodEnd as Date)?.getTime()
          expect(periodStart).toBe(periodStartTimestamp * 1000)
          expect(periodEnd).toBe(periodEndTimestamp * 1000)
        },
      })
    })

    it('should update subscriptionStatusUpdatedAt when status changes', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.updated',
        {
          status: 'past_due',
          current_period_start: periodStartTimestamp,
          current_period_end: periodEndTimestamp,
        },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_UPDATED }
      )

      const mock = createSubscriptionTransactionMock(
        [
          { id: '1', subscriptionStatus: 'active' }, // Status is changing
        ],
        1
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
        },
        expectedStatus: 200,
        customAssertions: () => {
          const capturedData = mock.getCapturedData()
          expect(capturedData).toMatchObject({
            subscriptionStatus: 'past_due',
            subscriptionStatusUpdatedAt: expect.any(Date),
          })
        },
      })
    })

    it('should clear period fields when subscription is canceled', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.deleted',
        { status: 'canceled' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CANCELED }
      )

      // Note: This test checks the subscription.deleted handler which uses prisma.student.update directly
      // (not in a transaction), so we need to mock it separately
      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          vi.mocked(prisma.student.findMany).mockResolvedValue([
            { id: '1', name: 'Child 1' },
          ] as any)
          vi.mocked(prisma.student.update).mockResolvedValue({} as any)
        },
        expectedStatus: 200,
        customAssertions: () => {
          const updateCalls = vi.mocked(prisma.student.update).mock.calls
          expect(updateCalls.length).toBeGreaterThan(0)

          const updateCall = updateCalls[0]
          expect(updateCall[0].data).toMatchObject({
            subscriptionStatus: 'canceled',
            status: 'withdrawn',
            currentPeriodStart: null, // ✅ Clear period fields
            currentPeriodEnd: null, // ✅ Clear period fields
            paidUntil: null,
            stripeSubscriptionIdDugsi: null,
            subscriptionStatusUpdatedAt: expect.any(Date),
          })
        },
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database transaction failures', async () => {
      const mockEvent = createCheckoutEvent(
        {},
        { id: TEST_CONSTANTS.EVENT_IDS.DB_ERROR }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createFailingTransactionMock(new Error('Database connection error'))
        },
        expectedStatus: 500,
        expectedBody: { message: 'Internal server error' },
        customAssertions: () => {
          expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({
            where: {
              eventId_source: {
                eventId: TEST_CONSTANTS.EVENT_IDS.DB_ERROR,
                source: 'dugsi',
              },
            },
          })
        },
      })
    })

    it('should return 200 for data issues to prevent retry', async () => {
      const mockEvent = createCheckoutEvent(
        {},
        { id: TEST_CONSTANTS.EVENT_IDS.NO_STUDENTS }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          vi.mocked(prisma.$transaction).mockImplementationOnce(
            async (fn: any) => {
              const tx = {
                student: {
                  updateMany: vi.fn().mockResolvedValue({ count: 0 }),
                },
              }
              await fn(tx)
              throw new Error('No students found for family test_family_123')
            }
          )
        },
        expectedStatus: 200,
        customAssertions: (response) => {
          const body = getResponseBody(response)
          expect(body.received).toBe(true)
          expect(body.warning).toContain('No students found')
        },
      })
    })

    it('should handle unhandled event types gracefully', async () => {
      const mockEvent = createBaseEvent({
        id: TEST_CONSTANTS.EVENT_IDS.UNHANDLED,
        type: 'invoice.payment_failed',
      })

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining(
              '⚠️ Unhandled Dugsi event type: invoice.payment_failed'
            )
          )
        },
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle customer object instead of string ID', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        {
          customer: {
            id: TEST_CONSTANTS.CUSTOMER.ID,
            object: 'customer',
          } as any,
        },
        { id: TEST_CONSTANTS.EVENT_IDS.CUSTOMER_OBJECT }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createSubscriptionTransactionMock([{ id: '1' }], 1)
        },
        expectedStatus: 200,
      })
    })

    it('should handle missing paidUntil field gracefully', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        { status: 'trialing' },
        { id: TEST_CONSTANTS.EVENT_IDS.NO_PERIOD_END }
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          createSubscriptionTransactionMock([{ id: '1' }], 1)
        },
        expectedStatus: 200,
      })
    })
  })

  describe('Status Mapping', () => {
    const statusMappingTests = [
      {
        subscriptionStatus: 'active' as const,
        expectedStatus: 'enrolled',
        description: 'should map active subscription to enrolled status',
      },
      {
        subscriptionStatus: 'past_due' as const,
        expectedStatus: 'enrolled',
        description:
          'should map past_due subscription to enrolled status (grace period)',
      },
      {
        subscriptionStatus: 'unpaid' as const,
        expectedStatus: 'withdrawn',
        description: 'should map unpaid subscription to withdrawn status',
      },
      {
        subscriptionStatus: 'trialing' as const,
        expectedStatus: 'registered',
        description: 'should map trialing subscription to registered status',
      },
    ]

    statusMappingTests.forEach(
      ({ subscriptionStatus, expectedStatus, description }) => {
        it(description, async () => {
          const eventType =
            subscriptionStatus === 'trialing'
              ? 'customer.subscription.created'
              : 'customer.subscription.updated'

          const mockEvent = createSubscriptionEvent(
            eventType,
            { status: subscriptionStatus },
            { id: `evt_${subscriptionStatus}_status` }
          )

          setupWebhookMocks(mockEvent)

          const { getCapturedData } = createCapturingTransactionMock([
            { id: '1', name: 'Child 1' },
          ])

          await POST(createTestRequest(mockEvent))

          expect(getCapturedData()).toMatchObject({
            subscriptionStatus,
            status: expectedStatus,
          })
        })
      }
    )
  })
})
