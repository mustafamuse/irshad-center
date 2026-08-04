import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteWebhookEventByIdAndSource } from '@/lib/db/queries/webhook-event'

import { createWebhookHandler } from '../base-webhook-handler'

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => (name === 'stripe-signature' ? 'sig_test' : null),
  })),
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn(async (_opts: unknown, fn: () => unknown) => await fn()),
}))

vi.mock('@/lib/db/queries/webhook-event', () => ({
  findWebhookEventByIdAndSource: vi.fn(async () => null),
  createWebhookEventRecord: vi.fn(async () => ({})),
  deleteWebhookEventByIdAndSource: vi.fn(async () => ({})),
}))

vi.mock('@/lib/logger', () => ({
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logError: vi.fn(async () => undefined),
  logInfo: vi.fn(async () => undefined),
}))

const EVENT = {
  id: 'evt_test_1',
  type: 'customer.subscription.deleted',
}

function makeHandler(handlerError: unknown) {
  return createWebhookHandler({
    source: 'dugsi',
    verifyWebhook: vi.fn(() => EVENT as never),
    eventHandlers: {
      'customer.subscription.deleted': vi.fn(async () => {
        throw handlerError
      }),
    },
  })
}

function makeRequest() {
  return new Request('http://localhost/api/webhook/dugsi', {
    method: 'POST',
    body: JSON.stringify({ id: EVENT.id }),
  })
}

describe('createWebhookHandler error classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 for Prisma errors despite their "Invalid `prisma...`" message prefix', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.subscription.update()` invocation: transaction conflict',
      { code: 'P2034', clientVersion: '0.0.0' }
    )
    const POST = makeHandler(prismaError)

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect(deleteWebhookEventByIdAndSource).toHaveBeenCalledWith(
      EVENT.id,
      'dugsi'
    )
  })

  it('returns 500 for Prisma validation errors', async () => {
    const prismaError = new Prisma.PrismaClientValidationError(
      'Invalid `prisma.subscription.update()` invocation: missing field',
      { clientVersion: '0.0.0' }
    )
    const POST = makeHandler(prismaError)

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })

  it('returns 400 for genuine validation errors and keeps the event record', async () => {
    const POST = makeHandler(new Error('Invalid subscription amount'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ message: 'Validation error' })
    expect(deleteWebhookEventByIdAndSource).not.toHaveBeenCalled()
  })

  it('returns 500 for unknown errors so Stripe retries', async () => {
    const POST = makeHandler(new Error('something unexpected'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })
})
