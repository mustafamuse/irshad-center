import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockLookupByEmail,
  mockCheckRateLimit,
  mockHeaders,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockLookupByEmail: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('@/lib/services/mahad/verification-service', () => ({
  lookupByEmail: (...args: unknown[]) => mockLookupByEmail(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/safe-action', () => ({
  rateLimitedActionClient: {
    metadata: (meta: { actionName: string }) => ({
      schema: (schema: {
        safeParse: (input: unknown) => {
          success: boolean
          data?: unknown
          error?: { flatten: () => { fieldErrors: Record<string, string[]> } }
        }
      }) => ({
        action:
          (handler: (opts: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const h = await mockHeaders()
            const ip =
              h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
            const rateResult = await mockCheckRateLimit(
              `${meta.actionName}:${ip}`
            )
            if (!rateResult.success) {
              return {
                serverError: 'Too many attempts. Please try again later.',
              }
            }
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error!.flatten().fieldErrors }
            }
            try {
              return { data: await handler({ parsedInput: parsed.data }) }
            } catch (e) {
              if (e instanceof Error && 'code' in e) {
                return { serverError: e.message }
              }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
    }),
  },
}))

import { lookupMahadByEmail } from '../lookup-by-email'

describe('lookupMahadByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 0,
    })
  })

  it('returns the verification service result on success', async () => {
    mockLookupByEmail.mockResolvedValue({
      found: true,
      profileId: 'profile-1',
      firstName: 'Mohamed',
      registeredAt: '2026-01-15',
      status: { kind: 'awaiting_payment_link', label: 'x', detail: 'y', guidance: 'check_whatsapp' },
    })

    const result = await lookupMahadByEmail({ email: 'mohamed@test.com' })

    expect(result?.data).toMatchObject({ found: true, profileId: 'profile-1' })
    expect(mockLookupByEmail).toHaveBeenCalledWith('mohamed@test.com')
  })

  it('returns { found: false } when lookup misses', async () => {
    mockLookupByEmail.mockResolvedValue({ found: false })
    const result = await lookupMahadByEmail({ email: 'missing@test.com' })
    expect(result?.data).toEqual({ found: false })
  })

  it('rejects malformed email at validation', async () => {
    const result = await lookupMahadByEmail({ email: 'not-an-email' })
    expect(result?.validationErrors).toBeDefined()
    expect(mockLookupByEmail).not.toHaveBeenCalled()
  })

  it('returns serverError when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await lookupMahadByEmail({ email: 'mohamed@test.com' })

    expect(result?.serverError).toContain('Too many attempts')
    expect(mockLookupByEmail).not.toHaveBeenCalled()
  })

  it('logs the lookup attempt with method and outcome', async () => {
    mockLookupByEmail.mockResolvedValue({ found: false })
    await lookupMahadByEmail({ email: 'mohamed@test.com' })
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'email', outcome: 'not_found' }),
      'mahad.lookup.attempt'
    )
  })
})
