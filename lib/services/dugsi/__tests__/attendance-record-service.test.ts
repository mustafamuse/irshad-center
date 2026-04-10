/**
 * Attendance Record Service Tests
 *
 * Covers: transitionStatus (concurrent modification), adminCheckIn (idempotent noop)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

import { ERROR_CODES } from '@/lib/errors/action-error'

const {
  mockGetRecordStatus,
  mockUpdateManyAttendance,
  mockFindUniqueCheckIn,
  mockFindUniqueAttendance,
  mockCreateCheckIn,
  mockCreateAttendance,
  mockUpdateManyAttendanceInner,
  mockFindUniqueClosure,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetRecordStatus: vi.fn(),
  mockUpdateManyAttendance: vi.fn(),
  mockFindUniqueCheckIn: vi.fn(),
  mockFindUniqueAttendance: vi.fn(),
  mockCreateCheckIn: vi.fn(),
  mockCreateAttendance: vi.fn(),
  mockUpdateManyAttendanceInner: vi.fn(),
  mockFindUniqueClosure: vi.fn(),
  mockTransaction: vi.fn(),
}))

function makeTx() {
  return {
    dugsiTeacherCheckIn: {
      findUnique: (...args: unknown[]) => mockFindUniqueCheckIn(...args),
      create: (...args: unknown[]) => mockCreateCheckIn(...args),
    },
    teacherAttendanceRecord: {
      findUnique: (...args: unknown[]) => mockFindUniqueAttendance(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyAttendanceInner(...args),
      create: (...args: unknown[]) => mockCreateAttendance(...args),
    },
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    teacherAttendanceRecord: {
      updateMany: (...args: unknown[]) => mockUpdateManyAttendance(...args),
    },
  },
}))

vi.mock('@/lib/db/queries/teacher-attendance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/queries/teacher-attendance')>()
  return {
    ...actual,
    getAttendanceRecordStatus: (...args: unknown[]) => mockGetRecordStatus(...args),
    getAttendanceRecordById: vi.fn(),
    getAttendanceRecord: vi.fn(),
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

import { transitionStatus, adminCheckIn } from '../attendance-record-service'

describe('transitionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // transitionStatus now wraps read + write in a $transaction — set up the
    // pass-through so doWrites runs against makeTx() (which routes calls to the
    // hoisted mocks). mockGetRecordStatus is a module-level mock so it works
    // regardless of which client (tx or prisma) is passed to it.
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(makeTx()))
  })

  it('transitions EXPECTED → PRESENT successfully', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'EXPECTED' })
    // transitionStatus calls tx.teacherAttendanceRecord.updateMany (the tx-level mock)
    mockUpdateManyAttendanceInner.mockResolvedValue({ count: 1 })

    await transitionStatus({ recordId: 'rec-1', toStatus: 'PRESENT', source: 'ADMIN_OVERRIDE' })

    expect(mockUpdateManyAttendanceInner).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'rec-1', status: 'EXPECTED' }) })
    )
  })

  it('throws ATTENDANCE_RECORD_NOT_FOUND when record missing', async () => {
    mockGetRecordStatus.mockResolvedValue(null)

    await expect(
      transitionStatus({ recordId: 'no-such', toStatus: 'PRESENT', source: 'ADMIN_OVERRIDE' })
    ).rejects.toMatchObject({ code: ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND })
  })

  it('throws INVALID_TRANSITION for disallowed status change', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'CLOSED' })

    await expect(
      transitionStatus({ recordId: 'rec-1', toStatus: 'ABSENT', source: 'ADMIN_OVERRIDE' })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_TRANSITION })
  })

  it('throws CONCURRENT_MODIFICATION when updateMany count === 0', async () => {
    // Simulates a concurrent override that already changed the status between
    // the getAttendanceRecordStatus read and the updateMany write.
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'EXPECTED' })
    // Concurrent write already changed the row — updateMany finds no matching EXPECTED row.
    mockUpdateManyAttendanceInner.mockResolvedValue({ count: 0 })

    await expect(
      transitionStatus({ recordId: 'rec-1', toStatus: 'PRESENT', source: 'ADMIN_OVERRIDE' })
    ).rejects.toMatchObject({ code: ERROR_CODES.CONCURRENT_MODIFICATION })
  })
})

describe('adminCheckIn', () => {
  const baseParams = {
    teacherId: 't-1',
    shift: 'MORNING' as const,
    date: new Date('2026-03-01T12:00:00Z'),
    changedBy: 'admin-user',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: transaction passes through to the callback
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(makeTx()))
  })

  it('creates check-in and attendance record when no prior state exists', async () => {
    mockFindUniqueCheckIn.mockResolvedValue(null)
    const fakeCheckIn = { id: 'ci-1', clockInTime: new Date() }
    mockCreateCheckIn.mockResolvedValue(fakeCheckIn)
    mockFindUniqueAttendance.mockResolvedValue(null)
    mockCreateAttendance.mockResolvedValue({})

    const result = await adminCheckIn(baseParams)

    expect(mockCreateCheckIn).toHaveBeenCalled()
    expect(mockCreateAttendance).toHaveBeenCalled()
    expect(result.checkIn).toBe(fakeCheckIn)
  })

  it('is idempotent — returns early when teacher is already PRESENT', async () => {
    const fakeCheckIn = { id: 'ci-1', clockInTime: new Date() }
    mockFindUniqueCheckIn.mockResolvedValue(fakeCheckIn)
    mockFindUniqueAttendance.mockResolvedValue({ status: 'PRESENT' })

    const result = await adminCheckIn(baseParams)

    // Should not write a new check-in or attendance record
    expect(mockCreateCheckIn).not.toHaveBeenCalled()
    expect(mockCreateAttendance).not.toHaveBeenCalled()
    expect(mockUpdateManyAttendanceInner).not.toHaveBeenCalled()
    expect(result.checkIn).toBe(fakeCheckIn)
  })

  it('throws CONCURRENT_MODIFICATION when attendance update count === 0', async () => {
    mockFindUniqueCheckIn.mockResolvedValue(null)
    mockCreateCheckIn.mockResolvedValue({ id: 'ci-1', clockInTime: new Date() })
    mockFindUniqueAttendance.mockResolvedValue({ status: 'EXPECTED' })
    mockUpdateManyAttendanceInner.mockResolvedValue({ count: 0 })

    await expect(adminCheckIn(baseParams)).rejects.toMatchObject({
      code: ERROR_CODES.CONCURRENT_MODIFICATION,
    })
  })
})
