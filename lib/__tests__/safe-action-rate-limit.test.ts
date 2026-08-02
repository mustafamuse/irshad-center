import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { mockCheckRateLimit, mockHeaders } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('next/navigation', () => ({
  unstable_rethrow: () => undefined,
}))

vi.mock('@/lib/auth', () => ({
  assertAdmin: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
}))

import { rateLimitedActionClient } from '@/lib/safe-action'

const testAction = rateLimitedActionClient
  .metadata({ actionName: 'testAction', maxAttempts: 3 })
  .schema(z.object({ value: z.string() }))
  .action(async ({ parsedInput }) => ({ echoed: parsedInput.value }))

describe('rateLimitedActionClient maxAttempts plumbing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 2,
      reset: 0,
    })
  })

  it('passes actionName-keyed identifier, maxAttempts, and failClosed to checkRateLimit', async () => {
    await testAction({ value: 'hi' })

    expect(mockCheckRateLimit).toHaveBeenCalledWith('testAction:1.2.3.4', 3, {
      failClosed: true,
    })
  })

  it('returns serverError and skips the handler when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await testAction({ value: 'hi' })

    expect(result?.data).toBeUndefined()
    expect(result?.serverError).toBeDefined()
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    mockHeaders.mockResolvedValue(new Headers({ 'x-real-ip': '5.6.7.8' }))

    await testAction({ value: 'hi' })

    expect(mockCheckRateLimit).toHaveBeenCalledWith('testAction:5.6.7.8', 3, {
      failClosed: true,
    })
  })

  it('uses the shared unknown bucket when no IP headers are present', async () => {
    mockHeaders.mockResolvedValue(new Headers())

    await testAction({ value: 'hi' })

    expect(mockCheckRateLimit).toHaveBeenCalledWith('testAction:unknown', 3, {
      failClosed: true,
    })
  })
})
