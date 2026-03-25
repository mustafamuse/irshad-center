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

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      id: 'profile-123',
      name: 'Ahmed Mohamed',
    })
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
    mockCreateMahadStudent.mockResolvedValue({ id: 'profile-123' })

    await registerStudent(validInput)

    expect(mockAfter).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should return validation error for invalid data', async () => {
    const result = await registerStudent({
      ...validInput,
      firstName: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockCreateMahadStudent).not.toHaveBeenCalled()
  })

  it('should return validation error for invalid email', async () => {
    const result = await registerStudent({
      ...validInput,
      email: 'not-an-email',
    })

    expect(result.success).toBe(false)
    expect(result.errors?.email).toBeDefined()
  })

  it('should handle P2002 duplicate error from database', async () => {
    const { Prisma } = await import('@prisma/client')
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0' }
    )
    mockCreateMahadStudent.mockRejectedValue(prismaError)

    const result = await registerStudent(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toContain('already exists')
  })

  it('should map P2002 phone constraint to phone field', async () => {
    const { Prisma } = await import('@prisma/client')
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['type', 'value_phone'] },
      }
    )
    Object.assign(prismaError, { meta: { target: ['type', 'value_phone'] } })
    mockCreateMahadStudent.mockRejectedValue(prismaError)

    const result = await registerStudent(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toContain('phone')
    expect(result.errors?.phone).toBeDefined()
  })

  it('should handle unexpected errors', async () => {
    mockCreateMahadStudent.mockRejectedValue(
      new Error('Database connection lost')
    )

    const result = await registerStudent(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database connection lost')
    expect(mockLogError).toHaveBeenCalled()
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

  it('should return false (fail open) when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    })

    const result = await checkEmailExists('test@example.com')

    expect(result).toBe(false)
    expect(mockIsEmailRegistered).not.toHaveBeenCalled()
  })
})
