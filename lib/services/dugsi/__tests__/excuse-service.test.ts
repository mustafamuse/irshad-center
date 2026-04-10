/**
 * Excuse Service Tests
 *
 * Covers: submitExcuse eligibility checks, approveExcuse concurrent modification
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

import { ERROR_CODES } from '@/lib/errors/action-error'

const {
  mockGetRecordStatus,
  mockGetExcuseById,
  mockGetExistingActiveExcuse,
  mockExcuseCreate,
  mockExcuseUpdate,
  mockFindUniqueRecord,
  mockUpdateManyRecord,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetRecordStatus: vi.fn(),
  mockGetExcuseById: vi.fn(),
  mockGetExistingActiveExcuse: vi.fn(),
  mockExcuseCreate: vi.fn(),
  mockExcuseUpdate: vi.fn(),
  mockFindUniqueRecord: vi.fn(),
  mockUpdateManyRecord: vi.fn(),
  mockTransaction: vi.fn(),
}))

function makeTx() {
  return {
    excuseRequest: {
      create: (...args: unknown[]) => mockExcuseCreate(...args),
      update: (...args: unknown[]) => mockExcuseUpdate(...args),
    },
    teacherAttendanceRecord: {
      findUnique: (...args: unknown[]) => mockFindUniqueRecord(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyRecord(...args),
    },
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/teacher-attendance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/queries/teacher-attendance')>()
  return {
    ...actual,
    getAttendanceRecordStatus: (...args: unknown[]) => mockGetRecordStatus(...args),
    getExcuseRequestById: (...args: unknown[]) => mockGetExcuseById(...args),
    getExistingActiveExcuse: (...args: unknown[]) => mockGetExistingActiveExcuse(...args),
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

import { submitExcuse, approveExcuse } from '../excuse-service'

describe('submitExcuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(makeTx()))
  })

  it('throws ATTENDANCE_RECORD_NOT_FOUND when record is missing', async () => {
    mockGetRecordStatus.mockResolvedValue(null)

    await expect(
      submitExcuse({ attendanceRecordId: 'rec-x', teacherId: 't-1', reason: 'I was sick' })
    ).rejects.toMatchObject({ code: ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND })
  })

  it('throws EXCUSE_NOT_ELIGIBLE when teacherIds do not match', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-other', status: 'ABSENT' })

    await expect(
      submitExcuse({ attendanceRecordId: 'rec-1', teacherId: 't-1', reason: 'I was sick' })
    ).rejects.toMatchObject({ code: ERROR_CODES.EXCUSE_NOT_ELIGIBLE })
  })

  it('throws EXCUSE_NOT_ELIGIBLE when record status is not LATE or ABSENT', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'PRESENT' })

    await expect(
      submitExcuse({ attendanceRecordId: 'rec-1', teacherId: 't-1', reason: 'I was sick' })
    ).rejects.toMatchObject({ code: ERROR_CODES.EXCUSE_NOT_ELIGIBLE })
  })

  it('throws ALREADY_EXCUSED when a PENDING or APPROVED excuse exists', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'ABSENT' })
    mockGetExistingActiveExcuse.mockResolvedValue({ id: 'ex-1', status: 'PENDING' })

    await expect(
      submitExcuse({ attendanceRecordId: 'rec-1', teacherId: 't-1', reason: 'I was sick' })
    ).rejects.toMatchObject({ code: ERROR_CODES.ALREADY_EXCUSED })
  })

  it('creates excuse request for an eligible LATE record', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-1', teacherId: 't-1', status: 'LATE' })
    mockGetExistingActiveExcuse.mockResolvedValue(null)
    const fakeExcuse = { id: 'ex-new', status: 'PENDING' }
    mockExcuseCreate.mockResolvedValue(fakeExcuse)

    const result = await submitExcuse({
      attendanceRecordId: 'rec-1',
      teacherId: 't-1',
      reason: 'Car trouble',
    })

    expect(mockExcuseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', teacherId: 't-1' }),
      })
    )
    expect(result).toBe(fakeExcuse)
  })

  it('creates excuse request for an eligible ABSENT record', async () => {
    mockGetRecordStatus.mockResolvedValue({ id: 'rec-2', teacherId: 't-1', status: 'ABSENT' })
    mockGetExistingActiveExcuse.mockResolvedValue(null)
    mockExcuseCreate.mockResolvedValue({ id: 'ex-2', status: 'PENDING' })

    await submitExcuse({ attendanceRecordId: 'rec-2', teacherId: 't-1', reason: 'Family emergency' })

    expect(mockExcuseCreate).toHaveBeenCalled()
  })
})

describe('approveExcuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(makeTx()))
  })

  it('throws when excuse request is not found', async () => {
    mockGetExcuseById.mockResolvedValue(null)

    await expect(
      approveExcuse({ excuseRequestId: 'ex-x', reviewedBy: 'admin' })
    ).rejects.toMatchObject({ code: ERROR_CODES.EXCUSE_REQUEST_NOT_FOUND })
  })

  it('throws INVALID_TRANSITION when excuse is already non-PENDING', async () => {
    mockGetExcuseById.mockResolvedValue({ id: 'ex-1', status: 'APPROVED', attendanceRecordId: 'rec-1' })

    await expect(
      approveExcuse({ excuseRequestId: 'ex-1', reviewedBy: 'admin' })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_TRANSITION })
  })

  it('throws CONCURRENT_MODIFICATION when attendance updateMany count === 0', async () => {
    // Simulates a concurrent admin override that changed the attendance record
    // between excuse submission and this approval attempt.
    mockGetExcuseById.mockResolvedValue({ id: 'ex-1', status: 'PENDING', attendanceRecordId: 'rec-1' })
    // Record is LATE (valid for EXCUSED transition), but the optimistic lock fails
    mockFindUniqueRecord.mockResolvedValue({ status: 'LATE' })
    mockExcuseUpdate.mockResolvedValue({ id: 'ex-1', status: 'APPROVED' })
    mockUpdateManyRecord.mockResolvedValue({ count: 0 })

    await expect(
      approveExcuse({ excuseRequestId: 'ex-1', reviewedBy: 'admin' })
    ).rejects.toMatchObject({ code: ERROR_CODES.CONCURRENT_MODIFICATION })
  })

  it('approves excuse and flips attendance to EXCUSED', async () => {
    mockGetExcuseById.mockResolvedValue({ id: 'ex-1', status: 'PENDING', attendanceRecordId: 'rec-1' })
    mockFindUniqueRecord.mockResolvedValue({ status: 'LATE' })
    const approvedExcuse = { id: 'ex-1', status: 'APPROVED' }
    mockExcuseUpdate.mockResolvedValue(approvedExcuse)
    mockUpdateManyRecord.mockResolvedValue({ count: 1 })

    const result = await approveExcuse({ excuseRequestId: 'ex-1', reviewedBy: 'admin' })

    expect(mockUpdateManyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXCUSED' }),
      })
    )
    expect(result).toBe(approvedExcuse)
  })
})
