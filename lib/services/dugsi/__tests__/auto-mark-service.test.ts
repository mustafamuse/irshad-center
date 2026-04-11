/**
 * Auto-mark Service Tests
 *
 * Covers: window not passed, school closed (in-tx guard), idempotent on second call
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetConfig,
  mockGetActiveTeachers,
  mockFindUniqueClosure,
  mockUpdateMany,
  mockCreateMany,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockGetActiveTeachers: vi.fn(),
  mockFindUniqueClosure: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreateMany: vi.fn(),
  mockTransaction: vi.fn(),
}))

function makeTx() {
  return {
    schoolClosure: {
      findUnique: (...args: unknown[]) => mockFindUniqueClosure(...args),
    },
    teacherAttendanceRecord: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      createMany: (...args: unknown[]) => mockCreateMany(...args),
    },
  }
}

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
    getAttendanceConfig: (...args: unknown[]) => mockGetConfig(...args),
    getActiveDugsiTeacherShifts: (...args: unknown[]) =>
      mockGetActiveTeachers(...args),
  }
})

// generateExpectedSlots depends on createMany — mock the whole service import
vi.mock('../attendance-record-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../attendance-record-service')>()
  return {
    ...actual,
    generateExpectedSlots: vi
      .fn()
      .mockResolvedValue({ created: 0, skipped: 0 }),
  }
})

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}))

import { autoMarkLateForShift } from '../auto-mark-service'

const BASE_CONFIG = {
  id: 'singleton',
  morningAutoMarkMinutes: 15,
  afternoonAutoMarkMinutes: 15,
  updatedAt: new Date(),
  updatedBy: null,
}

describe('autoMarkLateForShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConfig.mockResolvedValue(BASE_CONFIG)
    mockGetActiveTeachers.mockResolvedValue([])
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
  })

  it('skips when the auto-mark window has not yet passed', async () => {
    // Morning class starts 9:00 AM CT; threshold is 9:15 AM CT.
    // Use a date far in the future — `new Date()` will always be before the threshold.
    const result = await autoMarkLateForShift(
      '2099-06-07',
      'MORNING',
      BASE_CONFIG
    )

    expect(result).toMatchObject({
      kind: 'skipped',
      skippedReason: 'window_not_passed',
      marked: 0,
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('skips when school is closed (closure detected inside transaction)', async () => {
    // Past date — window has definitely passed.
    mockFindUniqueClosure.mockResolvedValue({
      id: 'cl-1',
      date: new Date('2026-02-01'),
    })

    const result = await autoMarkLateForShift(
      '2026-02-01',
      'MORNING',
      BASE_CONFIG
    )

    expect(result).toMatchObject({
      kind: 'skipped',
      skippedReason: 'school_closed',
      marked: 0,
    })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('marks EXPECTED records as LATE when window has passed and school is open', async () => {
    mockFindUniqueClosure.mockResolvedValue(null)
    mockGetActiveTeachers.mockResolvedValue([])
    mockUpdateMany.mockResolvedValue({ count: 3 })

    const result = await autoMarkLateForShift(
      '2026-02-07',
      'MORNING',
      BASE_CONFIG
    )

    expect(result).toMatchObject({ kind: 'marked', marked: 3 })
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'EXPECTED',
          shift: 'MORNING',
        }),
        data: expect.objectContaining({
          status: 'LATE',
          source: 'AUTO_MARKED',
          minutesLate: null,
        }),
      })
    )
  })

  it('is idempotent — returns 0 when no EXPECTED records remain (second run)', async () => {
    // All records were already marked LATE on the first cron run.
    mockFindUniqueClosure.mockResolvedValue(null)
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const result = await autoMarkLateForShift(
      '2026-02-07',
      'MORNING',
      BASE_CONFIG
    )

    expect(result).toMatchObject({
      kind: 'skipped',
      skippedReason: 'no_expected_records',
      marked: 0,
    })
  })
})
