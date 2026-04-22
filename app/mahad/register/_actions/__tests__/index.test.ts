import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockCreateMahadStudent,
  mockIsEmailRegistered,
  mockRevalidatePath,
  mockRevalidateTag,
  mockLoggerInfo,
  mockLogError,
  mockCheckRateLimit,
  mockHeaders,
  mockAfter,
} = vi.hoisted(() => ({
  mockCreateMahadStudent: vi.fn(),
  mockIsEmailRegistered: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLogError: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
  mockAfter: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}))

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('next/server', () => ({
  after: (fn: () => void) => mockAfter(fn),
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/services/duplicate-detection-service', () => ({
  DuplicateDetectionService: {
    isEmailRegistered: (...args: unknown[]) => mockIsEmailRegistered(...args),
  },
}))

vi.mock('@/lib/constants/mahad', () => ({
  MAHAD_PROGRAM: 'MAHAD_PROGRAM',
}))

vi.mock('@/lib/services/mahad/student-service', () => ({
  createMahadStudent: (...args: unknown[]) => mockCreateMahadStudent(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
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
              // ActionError extends Error and always has a `code` property
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

import { registerStudent, checkEmailExists } from '../index'

const validInput = {
  firstName: 'Ahmed',
  lastName: 'Mohamed',
  email: 'ahmed@example.com',
  phone: '612-555-1234',
  dateOfBirth: new Date('2005-06-15'),
  graduationStatus: 'NON_GRADUATE' as const,
  paymentFrequency: 'MONTHLY' as const,
}

describe('registerStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAfter.mockImplementation((fn: () => void) => fn())
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      reset: 0,
    })
    mockIsEmailRegistered.mockResolvedValue(false)
  })

  it('should register a student and return success with id and name', async () => {
    const mockProfile = { id: 'profile-123' }
    mockCreateMahadStudent.mockResolvedValue(mockProfile)

    const result = await registerStudent(validInput)

    expect(result?.data).toEqual({ id: 'profile-123', name: 'Ahmed Mohamed' })
    expect(mockCreateMahadStudent).toHaveBeenCalledWith({
      name: 'Ahmed Mohamed',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
      dateOfBirth: validInput.dateOfBirth,
      gradeLevel: undefined,
      schoolName: undefined,
      graduationStatus: 'NON_GRADUATE',
      paymentFrequency: 'MONTHLY',
    })
    expect(mockLoggerInfo).toHaveBeenCalled()
  })

  it('should use after() for non-blocking revalidation', async () => {
    mockAfter.mockImplementation(() => {})
    mockCreateMahadStudent.mockResolvedValue({ id: 'profile-123' })

    await registerStudent(validInput)

    expect(mockAfter).toHaveBeenCalledWith(expect.any(Function))
    const afterCallback = mockAfter.mock.calls[0][0] as () => void
    afterCallback()
    expect(mockRevalidateTag).toHaveBeenCalledWith('mahad-stats')
    expect(mockRevalidateTag).toHaveBeenCalledWith('mahad-students')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
  })

  it('should return validationErrors for invalid data', async () => {
    const result = await registerStudent({ ...validInput, firstName: '' })

    expect(result?.validationErrors).toBeDefined()
    expect(mockCreateMahadStudent).not.toHaveBeenCalled()
  })

  it('should return validationErrors for invalid email', async () => {
    const result = await registerStudent({
      ...validInput,
      email: 'not-an-email',
    })

    expect(result?.validationErrors?.email).toBeDefined()
  })

  it('should return validationErrors for P2002 duplicate email', async () => {
    const { Prisma } = await import('@prisma/client')
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email'] } }
    )
    mockCreateMahadStudent.mockRejectedValue(prismaError)

    const result = await registerStudent(validInput)

    expect(result?.validationErrors).toBeDefined()
    expect(
      (result?.validationErrors as { email?: { _errors: string[] } })?.email
        ?._errors?.[0]
    ).toContain('email')
  })

  it('should return validationErrors for P2002 duplicate phone', async () => {
    const { Prisma } = await import('@prisma/client')
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['phone'] } }
    )
    mockCreateMahadStudent.mockRejectedValue(prismaError)

    const result = await registerStudent(validInput)

    expect(result?.validationErrors).toBeDefined()
    expect(
      (result?.validationErrors as { phone?: { _errors: string[] } })?.phone
        ?._errors?.[0]
    ).toContain('phone')
  })

  it('should return validationErrors for ActionError with email field', async () => {
    const { ActionError } = await import('@/lib/errors/action-error')
    mockCreateMahadStudent.mockRejectedValue(
      new ActionError(
        'Student already registered for Mahad',
        'DUPLICATE_CONTACT',
        'email',
        409
      )
    )

    const result = await registerStudent(validInput)

    expect(result?.validationErrors).toBeDefined()
    expect(
      (result?.validationErrors as { email?: { _errors: string[] } })?.email
        ?._errors?.[0]
    ).toBe('Student already registered for Mahad')
    expect(result?.serverError).toBeUndefined()
  })

  it('should return validationErrors for ActionError with phone field', async () => {
    const { ActionError } = await import('@/lib/errors/action-error')
    mockCreateMahadStudent.mockRejectedValue(
      new ActionError(
        'Student already registered for Mahad',
        'DUPLICATE_CONTACT',
        'phone',
        409
      )
    )

    const result = await registerStudent(validInput)

    expect(result?.validationErrors).toBeDefined()
    expect(
      (result?.validationErrors as { phone?: { _errors: string[] } })?.phone
        ?._errors?.[0]
    ).toBe('Student already registered for Mahad')
  })

  it('should not log ActionError as server error', async () => {
    const { ActionError } = await import('@/lib/errors/action-error')
    mockCreateMahadStudent.mockRejectedValue(
      new ActionError('Duplicate', 'DUPLICATE_CONTACT', 'email')
    )

    await registerStudent(validInput)

    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should return serverError when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await registerStudent(validInput)

    expect(result?.serverError).toContain('Too many attempts')
    expect(mockCreateMahadStudent).not.toHaveBeenCalled()
  })

  it('should return serverError for unexpected errors', async () => {
    mockCreateMahadStudent.mockRejectedValue(
      new Error('Database connection lost')
    )

    const result = await registerStudent(validInput)

    expect(result?.serverError).toBe('Something went wrong')
    expect(result?.data).toBeUndefined()
  })
})

describe('checkEmailExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      reset: 0,
    })
  })

  it('should return true when email is registered', async () => {
    mockIsEmailRegistered.mockResolvedValue(true)

    const result = await checkEmailExists('test@example.com')

    expect(result).toBe(true)
    expect(mockIsEmailRegistered).toHaveBeenCalledWith(
      'test@example.com',
      'MAHAD_PROGRAM'
    )
  })

  it('should return false when email does not exist', async () => {
    mockIsEmailRegistered.mockResolvedValue(false)

    const result = await checkEmailExists('new@example.com')

    expect(result).toBe(false)
  })

  it('should rate limit with 10 attempts', async () => {
    mockIsEmailRegistered.mockResolvedValue(false)

    await checkEmailExists('test@example.com')

    expect(mockCheckRateLimit).toHaveBeenCalledWith('email-check:1.2.3.4', 10)
  })

  it('should rate limit under a shared bucket when IP is unavailable', async () => {
    mockHeaders.mockResolvedValue(new Headers())
    mockIsEmailRegistered.mockResolvedValue(false)

    const result = await checkEmailExists('test@example.com')

    expect(result).toBe(false)
    expect(mockCheckRateLimit).toHaveBeenCalledWith('email-check:unknown', 10)
    expect(mockIsEmailRegistered).toHaveBeenCalled()
  })

  it('should return false (fail closed) when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await checkEmailExists('test@example.com')

    expect(result).toBe(false)
    expect(mockIsEmailRegistered).not.toHaveBeenCalled()
  })

  it('should short-circuit to false for malformed email input', async () => {
    const result = await checkEmailExists('not-an-email')

    expect(result).toBe(false)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
    expect(mockIsEmailRegistered).not.toHaveBeenCalled()
  })
})
