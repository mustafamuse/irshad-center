// ⚠️ CRITICAL MIGRATION NEEDED: This test file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model
// All tests are skipped until migration is complete

/**
 * Dugsi Webhook Handler Tests
 *
 * Comprehensive test suite for the Dugsi webhook handler
 * ensuring proper payment method capture, subscription management,
 * and error handling.
 */

import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

import { POST } from '../route'
import {
  buildPrismaStudentTxMock,
  buildPaymentMethodTxMock,
  buildFailingTxMock,
  installTransaction,
} from './helpers'

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
    vi.mocked(verifyDugsiWebhook).mockImplementation(() => {
      throw options.verificationError
    })
  } else {
    // verifyDugsiWebhook takes (body: string, signature: string) and returns Stripe.Event
    vi.mocked(verifyDugsiWebhook).mockImplementation((_body, _signature) => {
      return event
    })
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

  // Debug: log response if status doesn't match
  if (response.status !== options.expectedStatus) {
    const body = getResponseBody(response)
    console.error('Unexpected response:', {
      status: response.status,
      expectedStatus: options.expectedStatus,
      body,
    })
    // Also log what verifyDugsiWebhook was called with
    const verifyCalls = vi.mocked(verifyDugsiWebhook).mock.calls
    console.error('verifyDugsiWebhook calls:', verifyCalls.length)
    if (verifyCalls.length > 0) {
      console.error('Last verify call:', {
        body: verifyCalls[verifyCalls.length - 1][0],
        signature: verifyCalls[verifyCalls.length - 1][1],
      })
    }
  }

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

describe.skip('Dugsi Webhook Handler', () => {
  beforeEach(async () => {
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()

    // Clear all mock call history (keeps implementations)
    vi.clearAllMocks()

    await setupHeadersMock()
    setupDefaultWebhookMocks()

    // Reset transaction mock to use the SAME prisma.student mock object
    // This ensures tests can mock prisma.student and it will work inside transactions
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = { student: prisma.student }
      return callback(tx as any)
    })

    // Set default verification mock (tests can override via setupWebhookMocks)
    // This mock will be used if setupWebhookMocks is not called
    vi.mocked(verifyDugsiWebhook).mockImplementation((body, _signature) => {
      // Try to parse the body - if it fails, return a minimal event
      try {
        const parsed = JSON.parse(body)
        // Ensure it has required fields
        if (parsed && parsed.id && parsed.type) {
          return parsed as Stripe.Event
        }
      } catch {
        // If parsing fails, return a minimal valid event
      }
      // Return a minimal valid event structure
      return {
        id: 'evt_default',
        object: 'event',
        type: 'checkout.session.completed',
        created: Date.now(),
        data: { object: {} },
      } as Stripe.Event
    })
  })

  afterEach(() => {
    // Note: We don't use vi.restoreAllMocks() here because it clears implementations
    // vi.resetAllMocks() in beforeEach handles cleanup between tests
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
          vi.mocked(verifyDugsiWebhook).mockImplementation(
            (_body, _signature) => {
              throw new Error('Webhook verification failed: Invalid signature')
            }
          )
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

      const { tx, spies } = buildPaymentMethodTxMock(2)
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: (response) => {
          if (response.status !== 200) {
            console.log(
              'Response body:',
              JSON.stringify(response.body, null, 2)
            )
          }
          expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
            data: {
              eventId: TEST_CONSTANTS.EVENT_IDS.NEW,
              eventType: 'checkout.session.completed',
              source: 'dugsi',
              payload: mockEvent,
            },
          })
          expect(spies.student.updateMany).toHaveBeenCalled()
        },
      })

      restore?.()
    })
  })

  describe('Payment Method Capture (checkout.session.completed)', () => {
    it('should update family students with payment method', async () => {
      const mockEvent = createCheckoutEvent(
        { customer_email: TEST_CONSTANTS.CUSTOMER.PARENT_EMAIL },
        { id: TEST_CONSTANTS.EVENT_IDS.PAYMENT }
      )

      const { tx, spies } = buildPaymentMethodTxMock(2)
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        expectedBody: { received: true },
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Updated 2 students')
          )
          expect(spies.student.updateMany).toHaveBeenCalled()
        },
      })

      restore?.()
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

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          { id: '1', name: 'Child 1' },
          { id: '2', name: 'Child 2' },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining(
              `✅ Updated 2 students with subscription ${TEST_CONSTANTS.SUBSCRIPTION.ID}`
            )
          )
          expect(spies.student.findMany).toHaveBeenCalled()
          // updateStudentsInTransaction uses update() for each student, not updateMany
          expect(spies.student.update).toHaveBeenCalledTimes(2)
        },
      })

      restore?.()
    })

    it('should handle subscription updates', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.updated',
        { status: 'past_due' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_UPDATED }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          { id: '1', name: 'Child 1' },
          { id: '2', name: 'Child 2' },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(spies.student.findMany).toHaveBeenCalled()
          // updateStudentsInTransaction uses update() for each student
          // This test has 2 students, so expect 2 calls
          expect(spies.student.update).toHaveBeenCalledTimes(2)
        },
      })

      restore?.()
    })

    it('should handle subscription cancellation', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.deleted',
        { status: 'canceled' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CANCELED }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          { id: '1', name: 'Child 1' },
          { id: '2', name: 'Child 2' },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(spies.student.findMany).toHaveBeenCalledWith({
            where: {
              stripeCustomerIdDugsi: TEST_CONSTANTS.CUSTOMER.ID,
              program: 'DUGSI_PROGRAM',
            },
          })
          expect(spies.student.update).toHaveBeenCalledTimes(2)

          const updateCall = spies.student.update.mock.calls[0]
          expect(updateCall[0].data).toMatchObject({
            subscriptionStatus: 'canceled',
            status: 'withdrawn',
          })
        },
      })

      restore?.()
    })

    it('should validate subscription status against enum', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        { status: 'invalid_status' as any },
        { id: TEST_CONSTANTS.EVENT_IDS.INVALID_STATUS }
      )

      const { install, restore } = buildFailingTxMock(
        new Error('Invalid subscription status: invalid_status')
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          install()
        },
        expectedStatus: 500,
        customAssertions: () => {
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Dugsi Webhook Error')
          )
        },
      })

      restore()
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
        { id: 'evt_period_fields_test' }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          {
            id: '1',
            name: 'Child 1',
            subscriptionStatus: null,
            stripeSubscriptionIdDugsi: null,
          },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Updated 1 students with subscription')
          )
          expect(spies.student.findMany).toHaveBeenCalled()
          expect(spies.student.update).toHaveBeenCalledTimes(1)

          // Verify period fields are synced correctly
          const updateCall = spies.student.update.mock.calls[0]
          expect(updateCall[0].data).toMatchObject({
            currentPeriodStart: expect.any(Date),
            currentPeriodEnd: expect.any(Date),
            paidUntil: expect.any(Date),
          })

          // Verify the dates match the subscription period
          const updateData = updateCall[0].data as any
          expect(updateData.currentPeriodStart?.getTime()).toBe(
            periodStartTimestamp * 1000
          )
          expect(updateData.currentPeriodEnd?.getTime()).toBe(
            periodEndTimestamp * 1000
          )
        },
      })

      restore?.()
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
        { id: 'evt_status_updated_test' }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          {
            id: '1',
            name: 'Child 1',
            subscriptionStatus: 'active', // Status changes from active to past_due
          },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Updated 1 students with subscription')
          )
          expect(spies.student.findMany).toHaveBeenCalled()
          expect(spies.student.update).toHaveBeenCalledTimes(1)

          // Verify subscriptionStatusUpdatedAt is set when status changes
          const updateCall = spies.student.update.mock.calls[0]
          expect(updateCall[0].data).toMatchObject({
            subscriptionStatus: 'past_due',
            status: 'enrolled',
            subscriptionStatusUpdatedAt: expect.any(Date),
          })
        },
      })

      restore?.()
    })

    it('should clear period fields when subscription is canceled', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.deleted',
        { status: 'canceled' },
        { id: TEST_CONSTANTS.EVENT_IDS.SUB_CANCELED }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [
          {
            id: '1',
            name: 'Child 1',
            subscriptionStatus: 'active',
          },
        ],
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(spies.student.findMany).toHaveBeenCalled()
          expect(spies.student.update).toHaveBeenCalledTimes(1)

          // Verify period fields are cleared on cancellation
          const updateCall = spies.student.update.mock.calls[0]
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

      restore?.()
    })
  })

  describe('Error Handling', () => {
    it('should handle database transaction failures', async () => {
      const mockEvent = createCheckoutEvent(
        {},
        { id: TEST_CONSTANTS.EVENT_IDS.DB_ERROR }
      )

      const { install, restore } = buildFailingTxMock(
        new Error('Database connection error')
      )

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          install()
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

      restore()
    })

    it('should return 200 for data issues to prevent retry', async () => {
      const mockEvent = createCheckoutEvent(
        {},
        { id: TEST_CONSTANTS.EVENT_IDS.NO_STUDENTS }
      )

      const updateMany = vi.fn().mockResolvedValue({ count: 0 })
      const tx = { student: { updateMany } }

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          // Override transaction to throw error after executing
          vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
            await fn(tx)
            throw new Error('No students found for family test_family_123')
          })
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

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [{ id: '1' }],
        updateCount: 1,
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(spies.student.findMany).toHaveBeenCalled()
          // updateStudentsInTransaction uses update() for each student
          // These tests have 1 student, so expect 1 call
          expect(spies.student.update).toHaveBeenCalledTimes(1)
        },
      })

      restore?.()
    })

    it('should handle missing paidUntil field gracefully', async () => {
      const mockEvent = createSubscriptionEvent(
        'customer.subscription.created',
        { status: 'trialing' },
        { id: TEST_CONSTANTS.EVENT_IDS.NO_PERIOD_END }
      )

      const { tx, spies } = buildPrismaStudentTxMock({
        students: [{ id: '1' }],
        updateCount: 1,
      })
      let restore: (() => void) | undefined

      await runWebhookTest({
        event: mockEvent,
        setupMocks: () => {
          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)
        },
        expectedStatus: 200,
        customAssertions: () => {
          expect(spies.student.findMany).toHaveBeenCalled()
          // updateStudentsInTransaction uses update() for each student
          // These tests have 1 student, so expect 1 call
          expect(spies.student.update).toHaveBeenCalledTimes(1)
        },
      })

      restore?.()
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

          const { tx, spies } = buildPrismaStudentTxMock({
            students: [{ id: '1', name: 'Child 1' }],
          })
          let restore: (() => void) | undefined

          setupWebhookMocks(mockEvent)
          restore = installTransaction(tx)

          await POST(createTestRequest(mockEvent))

          // Assert on the spy calls directly
          // updateStudentsInTransaction uses update() for each student, not updateMany
          expect(spies.student.update).toHaveBeenCalled()
          const updateCall = spies.student.update.mock.calls[0]
          expect(updateCall[0].data).toMatchObject({
            subscriptionStatus,
            status: expectedStatus,
          })

          restore?.()
        })
      }
    )
  })
})
