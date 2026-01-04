/**
 * Teacher Check-in Service Tests
 *
 * Tests for clock-in, clock-out, update, and delete operations.
 */

import { Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { CHECKIN_ERROR_CODES } from '@/lib/constants/teacher-checkin'
import { ValidationError } from '@/lib/services/validation-service'

const {
  mockIsEnrolled,
  mockGetShifts,
  mockGetTeacherCheckin,
  mockGetCheckinById,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockIsEnrolled: vi.fn(),
  mockGetShifts: vi.fn(),
  mockGetTeacherCheckin: vi.fn(),
  mockGetCheckinById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiTeacherCheckIn: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/teacher-checkin', () => ({
  isTeacherEnrolledInDugsi: (...args: unknown[]) => mockIsEnrolled(...args),
  getTeacherShifts: (...args: unknown[]) => mockGetShifts(...args),
  getTeacherCheckin: (...args: unknown[]) => mockGetTeacherCheckin(...args),
  getCheckinById: (...args: unknown[]) => mockGetCheckinById(...args),
}))

vi.mock('@/lib/constants/teacher-checkin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/constants/teacher-checkin')>()
  return {
    ...actual,
    isWithinGeofence: vi.fn(() => true),
    isLateForShift: vi.fn(() => false),
  }
})

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('@/lib/db/prisma-helpers', () => ({
  executeInTransaction: vi.fn(async (client, callback) => {
    const tx = {
      dugsiTeacherCheckIn: {
        delete: mockDelete,
      },
    }
    return callback(tx)
  }),
}))

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
    contactPoints: [
      { type: 'EMAIL', value: 'teacher@test.com' },
      { type: 'PHONE', value: '612-555-0001' },
    ],
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
    mockGetTeacherCheckin.mockResolvedValue(null)
    mockCreate.mockResolvedValue(mockCheckin)
  })

  it('should create check-in for enrolled teacher', async () => {
    const input = {
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await clockIn(input)

    expect(result.checkIn).toBeDefined()
    expect(result.checkIn.id).toBe('checkin-1')
    expect(mockCreate).toHaveBeenCalled()
  })

  it('should throw error if teacher is not enrolled in Dugsi', async () => {
    mockIsEnrolled.mockResolvedValue(false)

    const input = {
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    await expect(clockIn(input)).rejects.toThrow(ValidationError)
    await expect(clockIn(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.NOT_ENROLLED_IN_DUGSI,
    })
  })

  it('should throw error if teacher is not assigned to the shift', async () => {
    mockGetShifts.mockResolvedValue([Shift.AFTERNOON])

    const input = {
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    await expect(clockIn(input)).rejects.toThrow(ValidationError)
    await expect(clockIn(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.INVALID_SHIFT,
    })
  })

  it('should throw error if teacher already checked in for this shift', async () => {
    mockGetTeacherCheckin.mockResolvedValue(mockCheckin)

    const input = {
      teacherId: 'teacher-1',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    await expect(clockIn(input)).rejects.toThrow(ValidationError)
    await expect(clockIn(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN,
    })
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

  it('should update check-in with clock-out time', async () => {
    const input = {
      checkInId: 'checkin-1',
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await clockOut(input)

    expect(result.checkIn.clockOutTime).toBeDefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('should throw error if check-in record not found', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    const input = {
      checkInId: 'nonexistent',
      latitude: 44.9778,
      longitude: -93.265,
    }

    await expect(clockOut(input)).rejects.toThrow(ValidationError)
    await expect(clockOut(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
    })
  })

  it('should throw error if teacher already clocked out', async () => {
    mockGetCheckinById.mockResolvedValue({
      ...mockCheckin,
      clockOutTime: new Date('2024-01-15T12:00:00'),
    })

    const input = {
      checkInId: 'checkin-1',
      latitude: 44.9778,
      longitude: -93.265,
    }

    await expect(clockOut(input)).rejects.toThrow(ValidationError)
    await expect(clockOut(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.ALREADY_CLOCKED_OUT,
    })
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
  })

  it('should update check-in fields', async () => {
    const input = {
      checkInId: 'checkin-1',
      isLate: true,
      notes: 'Updated by admin',
    }

    const result = await updateCheckin(input)

    expect(result.isLate).toBe(true)
    expect(result.notes).toBe('Updated by admin')
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('should throw error if check-in record not found', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    const input = {
      checkInId: 'nonexistent',
      isLate: false,
    }

    await expect(updateCheckin(input)).rejects.toThrow(ValidationError)
    await expect(updateCheckin(input)).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
    })
  })
})

describe('deleteCheckin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCheckinById.mockResolvedValue(mockCheckin)
    mockDelete.mockResolvedValue(undefined)
  })

  it('should delete check-in record', async () => {
    await deleteCheckin('checkin-1')

    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'checkin-1' },
    })
  })

  it('should throw error if check-in record not found', async () => {
    mockGetCheckinById.mockResolvedValue(null)

    await expect(deleteCheckin('nonexistent')).rejects.toThrow(ValidationError)
    await expect(deleteCheckin('nonexistent')).rejects.toMatchObject({
      code: CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
    })
  })
})
