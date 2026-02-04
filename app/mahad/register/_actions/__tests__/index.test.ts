import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockCreateMahadStudent,
  mockContactPointFindFirst,
  mockRevalidatePath,
  mockLoggerInfo,
  mockLogError,
} = vi.hoisted(() => ({
  mockCreateMahadStudent: vi.fn(),
  mockContactPointFindFirst: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contactPoint: {
      findFirst: (...args: unknown[]) => mockContactPointFindFirst(...args),
    },
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
    mockContactPointFindFirst.mockResolvedValue(null)
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
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    expect(mockLoggerInfo).toHaveBeenCalled()
  })

  it('should return field error when email already exists', async () => {
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-1',
      type: 'EMAIL',
      value: 'ahmed@example.com',
    })

    const result = await registerStudent(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toContain('already exists')
    expect(result.errors?.email).toBeDefined()
    expect(mockCreateMahadStudent).not.toHaveBeenCalled()
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
    expect(result.errors?.email).toBeDefined()
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
  })

  it('should return true when email exists', async () => {
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-1',
      type: 'EMAIL',
      value: 'test@example.com',
    })

    const result = await checkEmailExists('test@example.com')

    expect(result).toBe(true)
    expect(mockContactPointFindFirst).toHaveBeenCalledWith({
      where: {
        type: 'EMAIL',
        value: 'test@example.com',
      },
    })
  })

  it('should return false when email does not exist', async () => {
    mockContactPointFindFirst.mockResolvedValue(null)

    const result = await checkEmailExists('new@example.com')

    expect(result).toBe(false)
  })

  it('should normalize email to lowercase', async () => {
    mockContactPointFindFirst.mockResolvedValue(null)

    await checkEmailExists('  Test@Example.COM  ')

    expect(mockContactPointFindFirst).toHaveBeenCalledWith({
      where: {
        type: 'EMAIL',
        value: 'test@example.com',
      },
    })
  })
})
