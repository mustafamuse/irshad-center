import { headers } from 'next/headers'

import * as Sentry from '@sentry/nextjs'
import { describe, it, expect, vi, beforeEach } from 'vitest'


import {
  serializeError,
  getRequestContext,
  logError,
  logWarning,
  logInfo,
  createLogger,
  createWebhookLogger,
  createActionLogger,
  createAPILogger,
  createServiceLogger,
  createCronLogger,
  logger,
} from '../logger'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  getCurrentScope: vi.fn(() => ({
    getPropagationContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
    setTag: vi.fn(),
  })),
}))

vi.mock('next-axiom', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('pino', () => {
  const child = vi.fn(() => mockLogger)
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child,
  }
  const pino = vi.fn(() => mockLogger)
  Object.assign(pino, {
    stdSerializers: {
      err: (err: unknown) => err,
    },
  })
  return { default: pino }
})

vi.mock('pino-pretty', () => ({ default: vi.fn() }))

describe('serializeError', () => {
  it('passes through Error instances', () => {
    const error = new Error('test')
    const result = serializeError(error)
    expect(result.err).toBe(error)
  })

  it('handles Prisma-like errors with code and message', () => {
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint',
      meta: { target: ['email'] },
    }
    const result = serializeError(prismaError)
    expect(result.err).toBeInstanceOf(Error)
    expect(result.err.name).toBe('PrismaError')
    expect(result.err.message).toBe('Unique constraint')
    expect((result.err as Error & { code: string }).code).toBe('P2002')
    expect((result.err as Error & { meta: unknown }).meta).toEqual({
      target: ['email'],
    })
  })

  it('handles API errors with message and statusCode', () => {
    const apiError = {
      message: 'Not found',
      name: 'ResendError',
      statusCode: 404,
    }
    const result = serializeError(apiError)
    expect(result.err).toBeInstanceOf(Error)
    expect(result.err.name).toBe('ResendError')
    expect(result.err.message).toBe('Not found')
    expect((result.err as Error & { statusCode: number }).statusCode).toBe(404)
  })

  it('defaults API error name to APIError', () => {
    const apiError = { message: 'Something failed' }
    const result = serializeError(apiError)
    expect(result.err.name).toBe('APIError')
  })

  it('converts strings to Error', () => {
    const result = serializeError('string error')
    expect(result.err).toBeInstanceOf(Error)
    expect(result.err.message).toBe('string error')
  })

  it('converts numbers to Error', () => {
    const result = serializeError(42)
    expect(result.err.message).toBe('42')
  })

  it('converts null to Error', () => {
    const result = serializeError(null)
    expect(result.err.message).toBe('null')
  })

  it('converts undefined to Error', () => {
    const result = serializeError(undefined)
    expect(result.err.message).toBe('undefined')
  })
})

describe('getRequestContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses x-request-id header when present', async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (name: string) => {
        if (name === 'x-request-id') return 'req-123'
        return null
      },
    } as Awaited<ReturnType<typeof headers>>)

    const ctx = await getRequestContext()
    expect(ctx.requestId).toBe('req-123')
  })

  it('falls back to Sentry trace ID when no header', async () => {
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as unknown as Awaited<ReturnType<typeof headers>>)

    const ctx = await getRequestContext()
    expect(ctx.requestId).toBe('test-trace-id')
  })

  it('generates background task ID when headers() throws', async () => {
    vi.mocked(headers).mockRejectedValue(new Error('Not in request context'))

    const ctx = await getRequestContext()
    expect(ctx.requestId).toBeDefined()
    expect(ctx.isBackgroundTask).toBe(true)
  })

  it('includes userId when present', async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (name: string) => {
        if (name === 'x-request-id') return 'req-1'
        if (name === 'x-user-id') return 'user-42'
        return null
      },
    } as Awaited<ReturnType<typeof headers>>)

    const ctx = await getRequestContext()
    expect(ctx.userId).toBe('user-42')
  })
})

describe('logError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockRejectedValue(new Error('no context'))
  })

  it('logs to Pino, Sentry, and does not throw', async () => {
    const mockLogger = createLogger({ source: 'test' })
    const error = new Error('test error')

    await logError(mockLogger, error, 'Something failed', { extra: 'data' })

    expect(mockLogger.error).toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ level: 'error' })
    )
  })

  it('handles non-Error values', async () => {
    const mockLogger = createLogger({ source: 'test' })

    await expect(
      logError(mockLogger, 'string error', 'Failed')
    ).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe('logWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockRejectedValue(new Error('no context'))
  })

  it('logs to Pino and adds Sentry breadcrumb', async () => {
    const mockLogger = createLogger({ source: 'test' })

    await logWarning(mockLogger, 'Watch out', { detail: 'info' })

    expect(mockLogger.warn).toHaveBeenCalled()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Watch out',
        level: 'warning',
      })
    )
  })
})

describe('logInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockRejectedValue(new Error('no context'))
  })

  it('logs to Pino', async () => {
    const mockLogger = createLogger({ source: 'test' })

    await logInfo(mockLogger, 'Event happened', { id: '123' })

    expect(mockLogger.info).toHaveBeenCalled()
  })
})

describe('logger factories', () => {
  it('createLogger returns a child logger', () => {
    const child = createLogger({ source: 'test' })
    expect(logger.child).toHaveBeenCalledWith({ source: 'test' })
    expect(child).toBeDefined()
  })

  it('createWebhookLogger includes program context', () => {
    createWebhookLogger('mahad')
    expect(logger.child).toHaveBeenCalledWith({
      source: 'webhook',
      program: 'mahad',
    })
  })

  it('createActionLogger includes action context', () => {
    createActionLogger('deleteFamily')
    expect(logger.child).toHaveBeenCalledWith({
      source: 'action',
      action: 'deleteFamily',
    })
  })

  it('createAPILogger includes route context', () => {
    createAPILogger('/api/health')
    expect(logger.child).toHaveBeenCalledWith({
      source: 'api',
      route: '/api/health',
    })
  })

  it('createServiceLogger includes service name', () => {
    createServiceLogger('UnifiedMatcher')
    expect(logger.child).toHaveBeenCalledWith({
      source: 'service',
      name: 'UnifiedMatcher',
    })
  })

  it('createCronLogger includes job context', () => {
    createCronLogger('cleanup')
    expect(logger.child).toHaveBeenCalledWith({
      source: 'cron',
      job: 'cleanup',
    })
  })
})
