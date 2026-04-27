/**
 * Admin Attendance Actions Tests
 *
 * Covers: generateExpectedSlotsAction CLOSURE_EXISTS guard
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

import { ActionError } from '@/lib/errors/action-error'

vi.mock('@/lib/safe-action', () => {
  function makeClient() {
    const client = {
      metadata: () => client,
      use: () => client,
      schema: (schema: z.ZodType) => ({
        action:
          (handler: (args: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error.flatten().fieldErrors }
            }
            try {
              const data = await handler({ parsedInput: parsed.data })
              return { data }
            } catch (error) {
              if (error instanceof ActionError)
                return { serverError: error.message }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
    }
    return client
  }
  return {
    actionClient: makeClient(),
    adminActionClient: makeClient(),
    rateLimitedActionClient: makeClient(),
  }
})

const {
  mockGetSchoolClosure,
  mockGetActiveTeachers,
  mockGenerateExpectedSlots,
  mockTransaction,
  mockAfter,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetSchoolClosure: vi.fn(),
  mockGetActiveTeachers: vi.fn(),
  mockGenerateExpectedSlots: vi.fn(),
  mockTransaction: vi.fn(),
  mockAfter: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('next/server', () => ({
  after: (fn: () => void) => mockAfter(fn),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/teacher-attendance', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/db/queries/teacher-attendance')>()
  return {
    ...actual,
    getSchoolClosure: (...args: unknown[]) => mockGetSchoolClosure(...args),
    getActiveDugsiTeacherShifts: (...args: unknown[]) =>
      mockGetActiveTeachers(...args),
    updateAttendanceConfig: vi.fn(),
  }
})

vi.mock(
  '@/lib/services/dugsi/attendance-record-service',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/services/dugsi/attendance-record-service')
      >()
    return {
      ...actual,
      generateExpectedSlots: (...args: unknown[]) =>
        mockGenerateExpectedSlots(...args),
      transitionStatus: vi.fn(),
      adminCheckIn: vi.fn(),
    }
  }
)

vi.mock('@/lib/services/dugsi/school-closure-service', () => ({
  markDateClosed: vi.fn(),
  removeClosure: vi.fn(),
}))

vi.mock('@/lib/services/dugsi/excuse-service', () => ({
  approveExcuse: vi.fn(),
  rejectExcuse: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
  logError: vi.fn(),
}))

import { generateExpectedSlotsAction } from '../actions'

describe('generateExpectedSlotsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}))
    mockGetSchoolClosure.mockResolvedValue(null)
    mockGetActiveTeachers.mockResolvedValue([])
    mockGenerateExpectedSlots.mockResolvedValue({ created: 0, skipped: 0 })
  })

  it('returns CLOSURE_EXISTS error when the date is already marked closed', async () => {
    mockGetSchoolClosure.mockResolvedValue({
      id: 'cl-1',
      date: new Date('2026-02-07'),
      reason: 'Holiday',
    })

    const result = await generateExpectedSlotsAction({ date: '2026-02-07' })

    expect(result?.serverError).toMatch(/already marked closed/)
    expect(mockGenerateExpectedSlots).not.toHaveBeenCalled()
  })

  it('calls generateExpectedSlots when date is open', async () => {
    mockGetSchoolClosure.mockResolvedValue(null)
    mockGetActiveTeachers.mockResolvedValue([
      { teacherId: 't-1', shifts: ['MORNING'] },
    ])
    mockGenerateExpectedSlots.mockResolvedValue({ created: 2, skipped: 0 })

    const result = await generateExpectedSlotsAction({ date: '2026-02-07' })

    expect(result?.serverError).toBeUndefined()
    expect(mockGenerateExpectedSlots).toHaveBeenCalled()
  })
})
