/**
 * School Closure Service Tests
 *
 * Covers:
 * - markDateClosed: EXPECTED → CLOSED propagation, AUTO_MARKED LATE → CLOSED bypass,
 *   duplicate closure guard, combined closedCount
 * - removeClosure: CLOSED → EXPECTED revert, missing closure guard
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSchoolClosure,
  mockCreateClosure,
  mockDeleteClosure,
  mockUpdateMany,
  mockExcuseUpdateMany,
  mockBulkTransitionStatus,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetSchoolClosure: vi.fn(),
  mockCreateClosure: vi.fn(),
  mockDeleteClosure: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockExcuseUpdateMany: vi.fn(),
  mockBulkTransitionStatus: vi.fn(),
  mockTransaction: vi.fn(),
}))

function makeTx() {
  return {
    schoolClosure: {
      create: (...args: unknown[]) => mockCreateClosure(...args),
      delete: (...args: unknown[]) => mockDeleteClosure(...args),
    },
    teacherAttendanceRecord: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    excuseRequest: {
      updateMany: (...args: unknown[]) => mockExcuseUpdateMany(...args),
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
    getSchoolClosure: (...args: unknown[]) => mockGetSchoolClosure(...args),
  }
})

vi.mock('../attendance-record-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../attendance-record-service')>()
  return {
    ...actual,
    bulkTransitionStatus: (...args: unknown[]) =>
      mockBulkTransitionStatus(...args),
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

import { markDateClosed, removeClosure } from '../school-closure-service'

const TEST_DATE = new Date('2026-02-07T12:00:00Z')
const FAKE_CLOSURE = { id: 'cl-1', date: TEST_DATE, reason: 'Snow day' }

describe('markDateClosed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
    mockGetSchoolClosure.mockResolvedValue(null)
    mockCreateClosure.mockResolvedValue(FAKE_CLOSURE)
    mockBulkTransitionStatus.mockResolvedValue(0)
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockExcuseUpdateMany.mockResolvedValue({ count: 0 })
  })

  it('flips EXPECTED records to CLOSED and returns closedCount', async () => {
    mockBulkTransitionStatus.mockResolvedValue(3)

    const result = await markDateClosed({
      date: TEST_DATE,
      reason: 'Snow day',
      createdBy: 'admin',
    })

    expect(result.closedCount).toBe(3)
    expect(mockBulkTransitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: TEST_DATE, status: 'EXPECTED' }),
        toStatus: 'CLOSED',
        source: 'SYSTEM',
      }),
      expect.anything() // tx
    )
  })

  it('also closes AUTO_MARKED LATE records when cron fired before admin marked closed', async () => {
    // Scenario: 21:00 UTC cron ran first, marking 2 teachers as AUTO_MARKED LATE.
    // Admin then creates a closure — those 2 records should flip to CLOSED too.
    mockBulkTransitionStatus.mockResolvedValue(1) // 1 EXPECTED → CLOSED
    mockUpdateMany.mockResolvedValue({ count: 2 }) // 2 AUTO_MARKED LATE → CLOSED

    const result = await markDateClosed({
      date: TEST_DATE,
      reason: 'Snow day',
      createdBy: 'admin',
    })

    expect(result.closedCount).toBe(3) // 1 + 2
    // LATE → CLOSED is intentionally excluded from ALLOWED_TRANSITIONS (override dialog
    // should never close a teacher who showed up via self-checkin). This updateMany
    // bypass only targets source=AUTO_MARKED records — teachers who never arrived.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { date: TEST_DATE, status: 'LATE', source: 'AUTO_MARKED' },
      data: expect.objectContaining({ status: 'CLOSED', source: 'SYSTEM' }),
    })
  })

  it('includes changedBy in both sweeps for audit trail', async () => {
    mockBulkTransitionStatus.mockResolvedValue(1)
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await markDateClosed({
      date: TEST_DATE,
      reason: 'Snow day',
      createdBy: 'admin',
    })

    expect(mockBulkTransitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ changedBy: 'admin' }),
      expect.anything()
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changedBy: 'admin' }),
      })
    )
  })

  it('throws CLOSURE_EXISTS when date is already closed', async () => {
    mockGetSchoolClosure.mockResolvedValue(FAKE_CLOSURE)

    await expect(
      markDateClosed({
        date: TEST_DATE,
        reason: 'Duplicate',
        createdBy: 'admin',
      })
    ).rejects.toMatchObject({ code: 'CLOSURE_EXISTS' })
    expect(mockCreateClosure).not.toHaveBeenCalled()
  })

  it('throws CLOSURE_EXISTS on P2002 (two admins both pass the guard and race to create)', async () => {
    // Both admins read no existing closure (READ COMMITTED), enter the transaction,
    // and race to insert. The loser's transaction is aborted by PostgreSQL with P2002.
    const { Prisma } = await import('@prisma/client')
    mockGetSchoolClosure.mockResolvedValue(null)
    mockCreateClosure.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    )

    await expect(
      markDateClosed({
        date: TEST_DATE,
        reason: 'Race condition',
        createdBy: 'admin',
      })
    ).rejects.toMatchObject({ code: 'CLOSURE_EXISTS' })
  })

  it('cancels PENDING/APPROVED excuses on AUTO_MARKED LATE records before flipping them', async () => {
    mockExcuseUpdateMany.mockResolvedValue({ count: 1 })
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await markDateClosed({
      date: TEST_DATE,
      reason: 'Snow day',
      createdBy: 'admin',
    })

    expect(mockExcuseUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'APPROVED'] },
          attendanceRecord: expect.objectContaining({
            date: TEST_DATE,
            status: 'LATE',
            source: 'AUTO_MARKED',
          }),
        }),
        data: expect.objectContaining({ status: 'REJECTED' }),
      })
    )
    // Excuse cancel must precede the attendance flip so the filter still matches LATE
    const excuseCallOrder = mockExcuseUpdateMany.mock.invocationCallOrder[0]
    const attendanceCallOrder = mockUpdateMany.mock.invocationCallOrder[0]
    expect(excuseCallOrder).toBeLessThan(attendanceCallOrder)
  })
})

describe('removeClosure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
    mockGetSchoolClosure.mockResolvedValue(FAKE_CLOSURE)
    mockDeleteClosure.mockResolvedValue(undefined)
    // reopenClosedRecords is now a module-private helper; it delegates to
    // tx.teacherAttendanceRecord.updateMany — same mock as the LATE→CLOSED sweep.
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockExcuseUpdateMany.mockResolvedValue({ count: 0 })
  })

  it('reverts CLOSED records to EXPECTED and returns reopenedCount', async () => {
    mockUpdateMany.mockResolvedValue({ count: 4 })

    const result = await removeClosure({ date: TEST_DATE })

    expect(result.reopenedCount).toBe(4)
    expect(mockDeleteClosure).toHaveBeenCalledWith({
      where: { date: TEST_DATE },
    })
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: TEST_DATE, status: 'CLOSED' }),
        data: expect.objectContaining({ status: 'EXPECTED', source: 'SYSTEM' }),
      })
    )
  })

  it('throws NOT_FOUND when no closure exists for the date', async () => {
    mockGetSchoolClosure.mockResolvedValue(null)

    await expect(removeClosure({ date: TEST_DATE })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(mockDeleteClosure).not.toHaveBeenCalled()
  })

  it('cancels PENDING/APPROVED excuses on CLOSED records before reopening', async () => {
    mockExcuseUpdateMany.mockResolvedValue({ count: 1 })
    mockUpdateMany.mockResolvedValue({ count: 2 })

    await removeClosure({ date: TEST_DATE, changedBy: 'admin' })

    expect(mockExcuseUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'APPROVED'] },
          attendanceRecord: expect.objectContaining({
            date: TEST_DATE,
            status: 'CLOSED',
          }),
        }),
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewedBy: 'admin',
        }),
      })
    )
  })
})
