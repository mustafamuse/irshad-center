import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMahadRegistration, mockCheckRateLimit, mockHeaders } =
  vi.hoisted(() => ({
    mockFindMahadRegistration: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockHeaders: vi.fn(),
  }))

vi.mock('@/lib/db/queries/mahad-public-lookup', () => ({
  findMahadRegistrationByNameAndPhoneLast4: (...args: unknown[]) =>
    mockFindMahadRegistration(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: vi.fn(),
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
              if (e instanceof Error && 'validationErrors' in e) {
                return {
                  validationErrors: (e as Error & { validationErrors: unknown })
                    .validationErrors,
                }
              }
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

import { lookupMahadRegistration } from '../lookup'

const validInput = {
  firstName: 'Abdi',
  lastName: 'Hassan',
  phoneLast4: '1234',
}

describe('lookupMahadRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 0,
    })
  })

  it('returns { found: false } when no registration matches', async () => {
    mockFindMahadRegistration.mockResolvedValue({ found: false })

    const result = await lookupMahadRegistration(validInput)

    expect(result?.data).toEqual({ found: false })
    expect(result?.serverError).toBeUndefined()
  })

  it('returns registeredAt and programStatusLabel when found — no studentName in response', async () => {
    mockFindMahadRegistration.mockResolvedValue({
      found: true,
      studentName: 'Abdi Hassan',
      registeredAt: '2026-02-15T08:30:00.000Z',
      programStatusLabel: 'Enrolled',
    })

    const result = await lookupMahadRegistration(validInput)

    expect(result?.data).toEqual({
      found: true,
      registeredAt: '2026-02-15T08:30:00.000Z',
      programStatusLabel: 'Enrolled',
    })
    expect(
      (result?.data as { studentName?: string } | undefined)?.studentName
    ).toBeUndefined()
  })

  it('returns validationErrors for non-numeric phoneLast4', async () => {
    const result = await lookupMahadRegistration({
      ...validInput,
      phoneLast4: '12a4',
    })

    expect(result?.validationErrors).toBeDefined()
    expect(mockFindMahadRegistration).not.toHaveBeenCalled()
  })

  it('returns validationErrors for phoneLast4 shorter than 4 digits', async () => {
    const result = await lookupMahadRegistration({
      ...validInput,
      phoneLast4: '123',
    })

    expect(result?.validationErrors).toBeDefined()
    expect(mockFindMahadRegistration).not.toHaveBeenCalled()
  })

  it('returns validationErrors for firstName below minimum length', async () => {
    const result = await lookupMahadRegistration({
      ...validInput,
      firstName: 'A',
    })

    expect(result?.validationErrors).toBeDefined()
    expect(mockFindMahadRegistration).not.toHaveBeenCalled()
  })

  it('returns serverError when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await lookupMahadRegistration(validInput)

    expect(result?.serverError).toContain('Too many attempts')
    expect(mockFindMahadRegistration).not.toHaveBeenCalled()
  })

  it('returns serverError for unexpected query errors', async () => {
    mockFindMahadRegistration.mockRejectedValue(
      new Error('Database connection lost')
    )

    const result = await lookupMahadRegistration(validInput)

    expect(result?.serverError).toBe('Something went wrong')
    expect(result?.data).toBeUndefined()
  })
})
