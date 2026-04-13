/**
 * Teacher Check-in Service Tests
 *
 * Tests for clock-in, clock-out, update, and delete operations.
 * clockIn wraps fact-log + attendance record writes in a $transaction.
 */

import { Prisma, Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockIsEnrolled,
  mockGetShifts,
  mockGetCheckinById,
  mockGetTeacherCheckin,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockTransaction,
  mockFindUniqueAttendance,
  mockUpdateManyAttendance,
  mockCreateAttendance,
  mockFindUniqueClosure,
} = vi.hoisted(() => ({
  mockIsEnrolled: vi.fn(),
  mockGetShifts: vi.fn(),
  mockGetCheckinById: vi.fn(),
  mockGetTeacherCheckin: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockFindUniqueAttendance: vi.fn(),
  mockUpdateManyAttendance: vi.fn(),
  mockCreateAttendance: vi.fn(),
  mockFindUniqueClosure: vi.fn(),
}))

// Build the tx object that is passed into every $transaction callback.
// Both dugsiTeacherCheckIn and teacherAttendanceRecord must be present
// because clockIn reads and writes both tables inside the transaction.
function makeTx() {
  return {
    dugsiTeacherCheckIn: {
      create: (...args: unknown[]) => mockCreate(...args),
      // update needed by updateCheckin, which now syncs TeacherAttendanceRecord inside
      // the same $transaction.
      update: (...args: unknown[]) => mockUpdate(...args),
      // delete must be present: deleteCheckin first nulls checkInId on the attendance
      // record, then deletes the check-in row (RESTRICT FK — delete must come last).
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    teacherAttendanceRecord: {
      findUnique: (...args: unknown[]) => mockFindUniqueAttendance(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyAttendance(...args),
      create: (...args: unknown[]) => mockCreateAttendance(...args),
    },
    // Required for the else branch (no pre-existing record): clockIn checks for
    // a school closure before creating a new attendance record.
    schoolClosure: {
      findUnique: (...args: unknown[]) => mockFindUniqueClosure(...args),
    },
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    // isPrismaClient() checks '$transaction' in client — must be present here.
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    dugsiTeacherCheckIn: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    teacherAttendanceRecord: {
      findUnique: (...args: unknown[]) => mockFindUniqueAttendance(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyAttendance(...args),
      create: (...args: unknown[]) => mockCreateAttendance(...args),
    },
  },
}))

vi.mock('@/lib/db/queries/teacher-checkin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/db/queries/teacher-checkin')>()
  return {
    ...actual,
    isTeacherEnrolledInDugsi: (...args: unknown[]) => mockIsEnrolled(...args),
    getTeacherShifts: (...args: unknown[]) => mockGetShifts(...args),
    getCheckinById: (...args: unknown[]) => mockGetCheckinById(...args),
    getTeacherCheckin: (...args: unknown[]) => mockGetTeacherCheckin(...args),
  }
})

const { mockIsWithinGeofence, mockIsGeofenceConfigured } = vi.hoisted(() => ({
  mockIsWithinGeofence: vi.fn((_lat: number, _lng: number) => true),
  mockIsGeofenceConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/constants/teacher-checkin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/constants/teacher-checkin')>()
  return {
    ...actual,
    isWithinGeofence: (lat: number, lng: number) =>
      mockIsWithinGeofence(lat, lng),
    isGeofenceConfigured: () => mockIsGeofenceConfigured(),
  }
})

vi.mock('@/lib/utils/evaluate-checkin', () => ({
  evaluateCheckIn: vi.fn(() => ({
    isLate: false,
    minutesLate: 0,
    deadlineUtc: new Date('2024-01-15T14:45:00Z'),
  })),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { CHECKIN_ERROR_CODES } from '@/lib/constants/teacher-checkin'
import { evaluateCheckIn } from '@/lib/utils/evaluate-checkin'

import {
  clockIn,
  clockOut,
  updateCheckin,
  deleteCheckin,
} from '../teacher-checkin-service'

const mockTeacher = {
  id: 'teacher-1',
  personId: 'person-1',
  person: {
    id: 'person-1',
    name: 'Test Teacher',
    email: 'teacher@test.com',
    phone: '6125550001',
  },
}

const mockCheckin = {
  id: 'checkin-1',
  teacherId: 'teacher-1',
  date: new Date('2024-01-15'),
  shift: Shift.MORNING,
  clockInTime: new Date('2024-01-15T08:25:00'),
  clockInLat: 44.9778,
  clockInLng: -93.265,
  clockInValid: true,
  clockOutTime: null,
  clockOutLat: null,
  clockOutLng: null,
  isLate: false,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  teacher: mockTeacher,
}

describe('clockIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsEnrolled.mockResolvedValue(true)
    mockGetShifts.mockResolvedValue([Shift.MORNING, Shift.AFTERNOON])
    mockIsWithinGeofence.mockReturnValue(true)
    mockIsGeofenceConfigured.mockReturnValue(true)
    // Pre-flight check: no existing checkin (happy path)
    mockGetTeacherCheckin.mockResolvedValue(null)
    // Transaction: checkin create returns fixture, attendance record doesn't exist yet
    mockCreate.mockResolvedValue(mockCheckin)
    mockFindUniqueAttendance.mockResolvedValue(null)
    mockCreateAttendance.mockResolvedValue({})
    mockUpdateManyAttendance.mockResolvedValue({ count: 1 })
    // No school closure by default (happy path); override in closure-specific tests.
    mockFindUniqueClosure.mockResolvedValue(null)
    // $transaction calls the doWrites callback with a tx object
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
  })

  it('creates check-in and returns the new record for an enrolled on-time teacher', async () => {
    const result = await clockIn({
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    })

    expect(result.checkIn.id).toBe('checkin-1')
    expect(mockCreate).toHaveBeenCalled()
    expect(evaluateCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ shift: Shift.MORNING })
    )
  })

  it('writes a PRESENT attendance record with source SELF_CHECKIN when teacher is on time', async () => {
    await clockIn({
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    })

    expect(mockCreateAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PRESENT',
          source: 'SELF_CHECKIN',
        }),
      })
    )
  })

  it('writes a LATE attendance record when evaluateCheckIn reports isLate=true', async () => {
    vi.mocked(evaluateCheckIn).mockReturnValueOnce({
      isLate: true,
      minutesLate: 5,
      deadlineUtc: new Date('2024-01-15T14:45:00Z'),
    })
    mockCreate.mockResolvedValue({ ...mockCheckin, isLate: true })

    await clockIn({
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isLate: true }),
      })
    )
    expect(mockCreateAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LATE' }),
      })
    )
  })

  it('updates existing EXPECTED attendance record to PRESENT instead of creating a new one', async () => {
    mockFindUniqueAttendance.mockResolvedValue({ status: 'EXPECTED' })

    await clockIn({
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    })

    expect(mockUpdateManyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'EXPECTED' }),
        data: expect.objectContaining({ status: 'PRESENT' }),
      })
    )
    expect(mockCreateAttendance).not.toHaveBeenCalled()
  })

  it('throws DUPLICATE_CHECKIN without entering the transaction when pre-flight finds an existing check-in', async () => {
    mockGetTeacherCheckin.mockResolvedValue(mockCheckin)

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('throws DUPLICATE_CHECKIN on P2002 when a concurrent insert races past the pre-flight check', async () => {
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      })
    )

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN })
  })

  it('throws CONCURRENT_MODIFICATION when attendance updateMany returns count 0 (concurrent status change)', async () => {
    mockFindUniqueAttendance.mockResolvedValue({ status: 'EXPECTED' })
    mockUpdateManyAttendance.mockResolvedValue({ count: 0 })

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.CONCURRENT_MODIFICATION,
    })
  })

  it('throws NOT_ENROLLED_IN_DUGSI when teacher is not enrolled', async () => {
    mockIsEnrolled.mockResolvedValue(false)

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.NOT_ENROLLED_IN_DUGSI })
  })

  it('throws INVALID_SHIFT when teacher is not assigned to the requested shift', async () => {
    mockGetShifts.mockResolvedValue([Shift.AFTERNOON])

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.INVALID_SHIFT })
  })

  it('throws SCHOOL_CLOSED without creating an attendance record when no prior record exists but a closure row does', async () => {
    // Covers the else-branch guard: generateExpectedSlots may not have run for the date,
    // so there is no CLOSED attendance record — the explicit schoolClosure.findUnique
    // check catches this case before a spurious record is created.
    mockFindUniqueAttendance.mockResolvedValue(null)
    mockFindUniqueClosure.mockResolvedValue({
      id: 'cl-1',
      date: new Date('2024-01-15'),
      reason: 'Holiday',
    })

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.SCHOOL_CLOSED })
    expect(mockCreateAttendance).not.toHaveBeenCalled()
  })

  it('throws SYSTEM_NOT_CONFIGURED when geofence is not configured', async () => {
    mockIsWithinGeofence.mockReturnValue(false)
    mockIsGeofenceConfigured.mockReturnValue(false)

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.SYSTEM_NOT_CONFIGURED })
  })

  it('throws ADMIN_OVERRIDE_EXISTS and does not modify attendance when existing ABSENT record was set by admin', async () => {
    mockFindUniqueAttendance.mockResolvedValue({
      status: 'ABSENT',
      source: 'ADMIN_OVERRIDE',
    })

    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.ADMIN_OVERRIDE_EXISTS })

    expect(mockUpdateManyAttendance).not.toHaveBeenCalled()
    expect(mockCreateAttendance).not.toHaveBeenCalled()
  })

  it('proceeds past provenance guard when existing ABSENT record was set by the cron (SYSTEM source)', async () => {
    mockFindUniqueAttendance.mockResolvedValue({
      status: 'ABSENT',
      source: 'SYSTEM',
    })
    mockUpdateManyAttendance.mockResolvedValue({ count: 1 })

    // Should not throw — provenance guard must not fire for auto-mark ABSENT.
    await expect(
      clockIn({
        teacherId: 'teacher-1',
        shift: Shift.MORNING,
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).resolves.toBeDefined()

    expect(mockUpdateManyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ABSENT' }),
        data: expect.objectContaining({ status: 'PRESENT' }),
      })
    )
  })
})

describe('clockOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCheckinById.mockResolvedValue(mockCheckin)
    mockUpdate.mockResolvedValue({
      ...mockCheckin,
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })
  })

  it('updates the check-in record with a clock-out time', async () => {
    const result = await clockOut({
      checkInId: 'checkin-1',
      teacherId: 'teacher-1',
      latitude: 44.9778,
      longitude: -93.265,
    })

    expect(result.checkIn.clockOutTime).toBeDefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws CHECKIN_NOT_FOUND when no check-in record exists for the given id', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    await expect(
      clockOut({
        checkInId: 'nonexistent',
        teacherId: 'teacher-1',
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND })
  })

  it('throws ALREADY_CLOCKED_OUT when clockOutTime is already set on the check-in', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })

    await expect(
      clockOut({
        checkInId: 'checkin-1',
        teacherId: 'teacher-1',
        latitude: 44.9778,
        longitude: -93.265,
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.ALREADY_CLOCKED_OUT })
  })
})

describe('updateCheckin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCheckinById.mockResolvedValue(mockCheckin)
    mockUpdate.mockResolvedValue({
      ...mockCheckin,
      isLate: true,
      notes: 'Updated by admin',
    })
    // updateCheckin now wraps writes in a $transaction — mirror the same setup
    // used in the clockIn/deleteCheckin describe blocks.
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
    mockUpdateManyAttendance.mockResolvedValue({ count: 1 })
  })

  it('updates isLate and notes fields and returns the updated record', async () => {
    const result = await updateCheckin({
      checkInId: 'checkin-1',
      isLate: true,
      notes: 'Updated by admin',
    })

    expect(result.isLate).toBe(true)
    expect(result.notes).toBe('Updated by admin')
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws CHECKIN_NOT_FOUND when no check-in record exists for the given id', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    await expect(
      updateCheckin({ checkInId: 'nonexistent', isLate: false })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND })
  })

  it('throws INVALID_TIME_ORDER when clockOutTime is before existing clockInTime', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      clockInTime: new Date('2024-01-15T10:00:00'),
      clockOutTime: null,
    })

    await expect(
      updateCheckin({
        checkInId: 'checkin-1',
        clockOutTime: new Date('2024-01-15T09:00:00'),
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.INVALID_TIME_ORDER })
  })

  it('throws INVALID_TIME_ORDER when new clockInTime is after existing clockOutTime', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      clockInTime: new Date('2024-01-15T08:00:00'),
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })

    await expect(
      updateCheckin({
        checkInId: 'checkin-1',
        clockInTime: new Date('2024-01-15T13:00:00'),
      })
    ).rejects.toMatchObject({ code: CHECKIN_ERROR_CODES.INVALID_TIME_ORDER })
  })

  it('accepts a clockOutTime that is after the existing clockInTime', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      clockInTime: new Date('2024-01-15T08:00:00'),
      clockOutTime: null,
    })
    mockUpdate.mockResolvedValue({
      ...mockCheckin,
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })

    const result = await updateCheckin({
      checkInId: 'checkin-1',
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })
    expect(result.clockOutTime).toEqual(new Date('2024-01-15T12:00:00'))
  })

  it('syncs linked attendance record with recomputed status and minutesLate when isLate is flipped', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      isLate: false,
      clockInTime: new Date('2024-01-15T08:25:00'),
    })
    mockUpdate.mockResolvedValue({ ...mockCheckin, isLate: true })

    await updateCheckin({ checkInId: 'checkin-1', isLate: true })

    expect(mockUpdateManyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkInId: 'checkin-1',
          status: { in: ['PRESENT', 'LATE'] },
        }),
        data: expect.objectContaining({
          status: 'LATE',
          source: 'ADMIN_OVERRIDE',
        }),
      })
    )
  })
})

describe('deleteCheckin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCheckinById.mockResolvedValue(mockCheckin)
    mockDelete.mockResolvedValue(undefined)
    mockUpdateManyAttendance.mockResolvedValue({ count: 1 })
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(makeTx())
    )
  })

  it('deletes the check-in row by id', async () => {
    await deleteCheckin('checkin-1')

    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'checkin-1' },
    })
  })

  it('nulls checkInId on ALL records before deleting to release RESTRICT FK', async () => {
    await deleteCheckin('checkin-1')

    expect(mockUpdateManyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { checkInId: 'checkin-1' },
        data: expect.objectContaining({
          checkInId: null,
          clockInTime: null,
          minutesLate: null,
        }),
      })
    )
  })

  it('nulls checkInId (step 1) before calling delete (step 2) to satisfy RESTRICT FK', async () => {
    await deleteCheckin('checkin-1')

    const firstUpdateOrder =
      mockUpdateManyAttendance.mock.invocationCallOrder[0]
    const deleteOrder = mockDelete.mock.invocationCallOrder[0]
    expect(firstUpdateOrder).toBeLessThan(deleteOrder)
  })

  it('reverts PRESENT/LATE attendance records to ABSENT after FK release', async () => {
    await deleteCheckin('checkin-1')

    // Two updateMany calls: FK nullification (any status) then PRESENT/LATE → ABSENT
    expect(mockUpdateManyAttendance).toHaveBeenCalledTimes(2)
    expect(mockUpdateManyAttendance).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PRESENT', 'LATE'] },
        }),
        data: expect.objectContaining({
          status: 'ABSENT',
          source: 'ADMIN_OVERRIDE',
        }),
      })
    )
  })

  it('throws CHECKIN_NOT_FOUND when no check-in record exists for the given id', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    await expect(deleteCheckin('nonexistent')).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
    })
  })
})
