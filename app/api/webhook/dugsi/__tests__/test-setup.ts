/**
 * Shared test setup for Dugsi webhook tests
 */

import type Stripe from 'stripe'
import { expect, vi } from 'vitest'

// Import mocks FIRST to ensure Vitest hoists them before importing prisma
import './mocks'

import { prisma } from '@/lib/db'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

// ============================================================================
// Test Constants
// ============================================================================

export const TEST_CONSTANTS = {
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
export function getResponseBody(response: { body: unknown; status: number }) {
  return response.body as Record<string, unknown>
}

/**
 * Create a base Stripe Event with common defaults
 */
export function createBaseEvent(
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
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
export function createCheckoutEvent(
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
    } as Stripe.Event['data'],
    ...overrides,
  } as Stripe.Event
}

/**
 * Create a Stripe Subscription object
 */
export function createSubscription(
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
    currency: 'usd',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test',
          object: 'subscription_item',
          price: {
            id: 'price_test',
            object: 'price',
            unit_amount: 30000, // $300.00 in cents
            currency: 'usd',
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    },
    ...overrides,
  } as Stripe.Subscription
}

/**
 * Create a Stripe Event for subscription events
 */
export function createSubscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  subscription: Partial<
    Stripe.Subscription & {
      current_period_start?: number
      current_period_end?: number
    }
  > = {},
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
  const subscriptionObj = createSubscription(
    subscription as Partial<Stripe.Subscription>
  )

  return {
    ...createBaseEvent(),
    type,
    data: {
      object: subscriptionObj,
      previous_attributes:
        type === 'customer.subscription.updated'
          ? { status: 'active' }
          : undefined,
    } as Stripe.Event['data'],
    ...overrides,
  } as Stripe.Event
}

/**
 * Create a test request with proper Stripe webhook payload
 */
export function createTestRequest(
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
export async function setupHeadersMock(
  signature: string | null = 'test_signature'
) {
  const headers = await import('next/headers')
  vi.mocked(headers.headers).mockResolvedValue({
    get: vi.fn().mockReturnValue(signature),
  } as unknown as Headers)
}

/**
 * Setup webhook verification and event state in one call
 */
export function setupWebhookMocks(
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
    } as unknown as Awaited<ReturnType<typeof prisma.webhookEvent.findUnique>>)
  } else {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
  }
}

/**
 * Setup default webhook event mocks
 * Note: Default mocks are set in mocks.ts, this function just resets them
 */
export function setupDefaultWebhookMocks() {
  // Reset mocks to default values
  // Use vi.mocked() directly like Mahad tests
  vi.mocked(prisma.webhookEvent.create).mockResolvedValue({
    id: '1',
    eventId: TEST_CONSTANTS.EVENT_IDS.TEST,
    eventType: 'test',
    source: 'dugsi',
    payload: {},
    createdAt: new Date(),
  } as unknown as Awaited<ReturnType<typeof prisma.webhookEvent.create>>)

  vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)

  vi.mocked(prisma.webhookEvent.delete).mockResolvedValue({
    id: '1',
    eventId: TEST_CONSTANTS.EVENT_IDS.TEST,
    eventType: 'test',
    source: 'dugsi',
    payload: {},
    createdAt: new Date(),
  } as unknown as Awaited<ReturnType<typeof prisma.webhookEvent.delete>>)
}

// ============================================================================
// Test Runner Helpers
// ============================================================================

/**
 * Helper to run a webhook test with common setup
 */
export async function runWebhookTest(options: {
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
  const { POST } = await import('../route')
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
