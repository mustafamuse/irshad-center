import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockLookupByNameAndDob,
  mockCheckRateLimit,
  mockHeaders,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockLookupByNameAndDob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('@/lib/services/mahad/verification-service', () => ({
  lookupByNameAndDob: (...args: unknown[]) => mockLookupByNameAndDob(...args),
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

import { lookupMahadByNameAndDob } from '../lookup-by-name-and-dob'

const validInput = {
  firstName: 'Mohamed',
  lastName: 'Ali',
  dateOfBirth: new Date('2005-03-15'),
}

describe('lookupMahadByNameAndDob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 0,
    })
  })

  it('passes input through to verification service', async () => {
    mockLookupByNameAndDob.mockResolvedValue({ found: false })
    await lookupMahadByNameAndDob(validInput)
    expect(mockLookupByNameAndDob).toHaveBeenCalledWith(validInput)
  })

  it('returns the found result on match', async () => {
    mockLookupByNameAndDob.mockResolvedValue({
      found: true,
      profileId: 'profile-1',
      firstName: 'Mohamed',
      registeredAt: '2026-01-15',
      status: { kind: 'payment_confirmed', label: 'x', detail: 'y', guidance: 'none' },
    })
    const result = await lookupMahadByNameAndDob(validInput)
    expect(result?.data).toMatchObject({ found: true, profileId: 'profile-1' })
  })

  it('rejects empty firstName at validation', async () => {
    const result = await lookupMahadByNameAndDob({
      ...validInput,
      firstName: '',
    })
    expect(result?.validationErrors).toBeDefined()
    expect(mockLookupByNameAndDob).not.toHaveBeenCalled()
  })

  it('rejects future DOB', async () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const result = await lookupMahadByNameAndDob({
      ...validInput,
      dateOfBirth: future,
    })
    expect(result?.validationErrors).toBeDefined()
    expect(mockLookupByNameAndDob).not.toHaveBeenCalled()
  })

  it('returns serverError when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })
    const result = await lookupMahadByNameAndDob(validInput)
    expect(result?.serverError).toContain('Too many attempts')
    expect(mockLookupByNameAndDob).not.toHaveBeenCalled()
  })

  it('logs the lookup attempt with method=name_dob and outcome', async () => {
    mockLookupByNameAndDob.mockResolvedValue({ found: false })
    await lookupMahadByNameAndDob(validInput)
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'name_dob', outcome: 'not_found' }),
      'mahad.lookup.attempt'
    )
  })
})
