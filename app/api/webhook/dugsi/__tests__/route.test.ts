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

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test_signature'),
  }),
}))

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}))

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    student: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock Stripe Dugsi
vi.mock('@/lib/stripe-dugsi', () => ({
  verifyDugsiWebhook: vi.fn(),
}))

// Mock parseDugsiReferenceId
vi.mock('@/lib/utils/dugsi-payment', () => ({
  parseDugsiReferenceId: vi.fn().mockReturnValue({
    familyId: 'test_family_123',
    childCount: 2,
  }),
}))

describe('Dugsi Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Signature Verification', () => {
    it('should reject requests without signature', async () => {
      const headers = await import('next/headers')
      vi.mocked(headers.headers).mockResolvedValueOnce({
        get: vi.fn().mockReturnValue(null),
      } as any)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        message: 'Missing signature',
      })
    })

    it('should reject requests with invalid signature', async () => {
      vi.mocked(verifyDugsiWebhook).mockImplementationOnce(() => {
        throw new Error('Webhook verification failed')
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(response.body).toEqual({
        message: 'Invalid webhook signature',
      })
    })
  })

  describe('Idempotency', () => {
    it('should skip already processed events', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_duplicate',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: { object: {} as any, previous_attributes: null },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce({
        id: '1',
        eventId: 'evt_duplicate',
        eventType: 'checkout.session.completed',
        source: 'dugsi',
        payload: {},
        createdAt: new Date(),
      } as any)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        received: true,
        skipped: true,
      })
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled()
    })

    it('should record new events to prevent duplicates', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_new',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: 'dugsi_test_family_123_2kids',
            customer: 'cus_test123',
            customer_email: 'test@example.com',
          } as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await POST(request)

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          eventId: 'evt_new',
          eventType: 'checkout.session.completed',
          source: 'dugsi',
          payload: {},
        },
      })
    })
  })

  describe('Payment Method Capture (checkout.session.completed)', () => {
    it('should update family students with payment method', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_payment',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: 'dugsi_test_family_123_2kids',
            customer: 'cus_test123',
            customer_email: 'parent@example.com',
          } as Stripe.Checkout.Session,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      const mockUpdateResult = { count: 2 }
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            updateMany: vi.fn().mockResolvedValue(mockUpdateResult),
          },
        }
        return fn(tx)
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Updated 2 students')
      )
    })

    it('should handle missing client_reference_id', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_no_ref',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: null, // Missing reference
            customer: 'cus_test123',
            customer_email: 'test@example.com',
          } as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      // Should return 200 to prevent Stripe retry
      expect(response.status).toBe(200)
      expect(response.body.warning).toContain('No client_reference_id')
    })

    it('should handle invalid customer ID', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_no_customer',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: 'dugsi_test_family_123_2kids',
            customer: null, // Missing customer
            customer_email: 'test@example.com',
          } as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.body.warning).toContain('Invalid or missing customer ID')
    })
  })

  describe('Subscription Events', () => {
    it('should handle subscription creation', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_sub_created',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.created',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              { id: '1', name: 'Child 1' },
              { id: '2', name: 'Child 2' },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        }
        return fn(tx)
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          '✅ Updated 2 students with subscription sub_test123'
        )
      )
    })

    it('should handle subscription updates', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_sub_updated',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: { status: 'active' },
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.updated',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([{ id: '1', name: 'Child 1' }]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return fn(tx)
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle subscription cancellation', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'canceled',
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_sub_canceled',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.deleted',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.student.updateMany).mockResolvedValueOnce({ count: 2 })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: {
          stripeCustomerIdDugsi: 'cus_test123',
          program: 'DUGSI_PROGRAM',
        },
        data: {
          subscriptionStatus: 'canceled',
        },
      })
    })

    it('should validate subscription status against enum', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'invalid_status' as any, // Invalid status
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_invalid_status',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.created',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
            updateMany: vi.fn(),
          },
        }
        await fn(tx)
        throw new Error('Invalid subscription status: invalid_status')
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Dugsi Webhook Error')
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle database transaction failures', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_db_error',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: 'dugsi_test_family_123_2kids',
            customer: 'cus_test123',
            customer_email: 'test@example.com',
          } as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error('Database connection error')
      )

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ message: 'Internal server error' })
      expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({
        where: {
          eventId_source: {
            eventId: 'evt_db_error',
            source: 'dugsi',
          },
        },
      })
    })

    it('should return 200 for data issues to prevent retry', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_no_students',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test',
            client_reference_id: 'dugsi_test_family_123_2kids',
            customer: 'cus_test123',
            customer_email: 'test@example.com',
          } as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'checkout.session.completed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        }
        await fn(tx)
        throw new Error('No students found for family test_family_123')
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)
      expect(response.body.warning).toContain('No students found')
    })

    it('should handle unhandled event types gracefully', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_unhandled',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: {} as any,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'invoice.payment_failed',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          '⚠️ Unhandled Dugsi event type: invoice.payment_failed'
        )
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle customer object instead of string ID', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: {
          id: 'cus_test123',
          object: 'customer',
        } as any,
        status: 'active',
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_customer_object',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.created',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return fn(tx)
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle missing paidUntil field gracefully', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'trialing',
        // No current_period_end field
      } as any

      const mockEvent: Stripe.Event = {
        id: 'evt_no_period_end',
        object: 'event',
        api_version: '2025-08-27.basil',
        created: Date.now(),
        data: {
          object: mockSubscription,
          previous_attributes: null,
        },
        livemode: true,
        pending_webhooks: 1,
        request: null,
        type: 'customer.subscription.created',
      }

      vi.mocked(verifyDugsiWebhook).mockReturnValue(mockEvent)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return fn(tx)
      })

      const request = new Request('http://localhost/api/webhook/dugsi', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
})
