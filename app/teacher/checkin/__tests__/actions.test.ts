import { Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { CHECKIN_ERROR_CODES } from '@/lib/constants/teacher-checkin'
import { ValidationError } from '@/lib/services/validation-service'

const {
  mockRevalidatePath,
  mockGetTeachersForDropdown,
  mockGetTeacherCheckin,
  mockClockIn,
  mockClockOut,
  mockCalculateDistance,
  mockIsWithinGeofence,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockGetTeachersForDropdown: vi.fn(),
  mockGetTeacherCheckin: vi.fn(),
  mockClockIn: vi.fn(),
  mockClockOut: vi.fn(),
  mockCalculateDistance: vi.fn(),
  mockIsWithinGeofence: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/db/queries/teacher-checkin', () => ({
  getDugsiTeachersForDropdown: (...args: unknown[]) =>
    mockGetTeachersForDropdown(...args),
  getTeacherCheckin: (...args: unknown[]) => mockGetTeacherCheckin(...args),
}))

vi.mock('@/lib/services/dugsi/teacher-checkin-service', () => ({
  clockIn: (...args: unknown[]) => mockClockIn(...args),
  clockOut: (...args: unknown[]) => mockClockOut(...args),
}))

vi.mock('@/lib/constants/teacher-checkin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/constants/teacher-checkin')>()
  return {
    ...actual,
    isWithinGeofence: (lat: number, lng: number) =>
      mockIsWithinGeofence(lat, lng),
    IRSHAD_CENTER_LOCATION: { lat: 44.9778, lng: -93.265 },
  }
})

vi.mock('@/lib/services/geolocation-service', () => ({
  calculateDistance: (...args: unknown[]) => mockCalculateDistance(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
}))

import {
  getDugsiTeachers,
  getTeacherCurrentStatus,
  teacherClockInAction,
  teacherClockOutAction,
  checkGeofence,
} from '../actions'

const mockTeacherDropdown = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    personId: 'person-1',
    name: 'Test Teacher',
    shifts: [Shift.MORNING, Shift.AFTERNOON],
  },
]

const mockCheckin = {
  id: 'checkin-1',
  teacherId: '550e8400-e29b-41d4-a716-446655440001',
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
}

describe('getDugsiTeachers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeachersForDropdown.mockResolvedValue(mockTeacherDropdown)
  })

  it('should return teachers from query', async () => {
    const result = await getDugsiTeachers()

    expect(result).toEqual(mockTeacherDropdown)
    expect(mockGetTeachersForDropdown).toHaveBeenCalled()
  })
})

describe('getTeacherCurrentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeacherCheckin.mockResolvedValue(null)
  })

  it('should return null values when no check-ins exist', async () => {
    const result = await getTeacherCurrentStatus(
      '550e8400-e29b-41d4-a716-446655440001'
    )

    expect(result).toEqual({
      morningCheckinId: null,
      morningClockInTime: null,
      morningClockOutTime: null,
      afternoonCheckinId: null,
      afternoonClockInTime: null,
      afternoonClockOutTime: null,
    })
  })

  it('should return status with morning check-in data', async () => {
    mockGetTeacherCheckin
      .mockResolvedValueOnce(mockCheckin)
      .mockResolvedValueOnce(null)

    const result = await getTeacherCurrentStatus(
      '550e8400-e29b-41d4-a716-446655440001'
    )

    expect(result.morningCheckinId).toBe('checkin-1')
    expect(result.morningClockInTime).toEqual(mockCheckin.clockInTime)
    expect(result.morningClockOutTime).toBeNull()
    expect(result.afternoonCheckinId).toBeNull()
  })

  it('should return status with afternoon check-in data', async () => {
    const afternoonCheckin = {
      ...mockCheckin,
      id: 'checkin-2',
      shift: Shift.AFTERNOON,
      clockInTime: new Date('2024-01-15T14:05:00'),
    }
    mockGetTeacherCheckin
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(afternoonCheckin)

    const result = await getTeacherCurrentStatus(
      '550e8400-e29b-41d4-a716-446655440001'
    )

    expect(result.morningCheckinId).toBeNull()
    expect(result.afternoonCheckinId).toBe('checkin-2')
    expect(result.afternoonClockInTime).toEqual(afternoonCheckin.clockInTime)
  })
})

describe('teacherClockInAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClockIn.mockResolvedValue({ checkIn: mockCheckin })
    mockGetTeacherCheckin.mockResolvedValue(null)
  })

  it('should return success with checkInId and status on valid input', async () => {
    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(true)
    expect(result.data?.checkInId).toBe('checkin-1')
    expect(result.data?.status).toBeDefined()
  })

  it('should call revalidatePath on success', async () => {
    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    await teacherClockInAction(input)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/teacher/checkin')
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/admin/dugsi/teacher-checkins'
    )
  })

  it('should return success message with late indicator when late', async () => {
    mockClockIn.mockResolvedValue({
      checkIn: { ...mockCheckin, isLate: true },
    })

    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(true)
    expect(result.message).toContain('Late')
  })

  it('should return error for invalid UUID format', async () => {
    const input = {
      teacherId: 'not-a-uuid',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockClockIn).not.toHaveBeenCalled()
  })

  it('should return error for coordinates out of range', async () => {
    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 100, // Invalid: must be between -90 and 90
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockClockIn).not.toHaveBeenCalled()
  })

  it('should return error for invalid longitude', async () => {
    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: 200, // Invalid: must be between -180 and 180
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockClockIn).not.toHaveBeenCalled()
  })

  it('should return error when ValidationError is thrown', async () => {
    mockClockIn.mockRejectedValue(
      new ValidationError(
        'Not enrolled in Dugsi',
        CHECKIN_ERROR_CODES.NOT_ENROLLED_IN_DUGSI
      )
    )

    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Not enrolled in Dugsi')
  })

  it('should return generic error for unexpected errors', async () => {
    mockClockIn.mockRejectedValue(new Error('Database connection failed'))

    const input = {
      teacherId: '550e8400-e29b-41d4-a716-446655440001',
      shift: Shift.MORNING,
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockInAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to clock in. Please try again.')
  })
})

describe('teacherClockOutAction', () => {
  const clockedOutCheckin = {
    ...mockCheckin,
    clockOutTime: new Date('2024-01-15T12:00:00'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockClockOut.mockResolvedValue({ checkIn: clockedOutCheckin })
    mockGetTeacherCheckin.mockResolvedValue(clockedOutCheckin)
  })

  it('should return success with status on valid input', async () => {
    const input = {
      checkInId: '550e8400-e29b-41d4-a716-446655440001',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockOutAction(input)

    expect(result.success).toBe(true)
    expect(result.data?.status).toBeDefined()
    expect(result.message).toBe('Clocked out successfully')
  })

  it('should call revalidatePath on success', async () => {
    const input = {
      checkInId: '550e8400-e29b-41d4-a716-446655440001',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      latitude: 44.9778,
      longitude: -93.265,
    }

    await teacherClockOutAction(input)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/teacher/checkin')
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/admin/dugsi/teacher-checkins'
    )
  })

  it('should return error for invalid checkInId UUID format', async () => {
    const input = {
      checkInId: 'not-a-uuid',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockOutAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockClockOut).not.toHaveBeenCalled()
  })

  it('should return error when ValidationError is thrown', async () => {
    mockClockOut.mockRejectedValue(
      new ValidationError(
        'Already clocked out',
        CHECKIN_ERROR_CODES.ALREADY_CLOCKED_OUT
      )
    )

    const input = {
      checkInId: '550e8400-e29b-41d4-a716-446655440001',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockOutAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Already clocked out')
  })

  it('should return generic error for unexpected errors', async () => {
    mockClockOut.mockRejectedValue(new Error('Database connection failed'))

    const input = {
      checkInId: '550e8400-e29b-41d4-a716-446655440001',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      latitude: 44.9778,
      longitude: -93.265,
    }

    const result = await teacherClockOutAction(input)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to clock out. Please try again.')
  })
})

describe('checkGeofence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCalculateDistance.mockReturnValue(25) // 25 meters
    mockIsWithinGeofence.mockReturnValue(true)
  })

  it('should return isWithinGeofence=true when location is within radius', async () => {
    mockIsWithinGeofence.mockReturnValue(true)
    mockCalculateDistance.mockReturnValue(25)

    const result = await checkGeofence(44.9778, -93.265)

    expect(result.isWithinGeofence).toBe(true)
    expect(result.distanceMeters).toBe(25)
    expect(result.allowedRadiusMeters).toBe(15)
  })

  it('should return isWithinGeofence=false when location is outside radius', async () => {
    mockIsWithinGeofence.mockReturnValue(false)
    mockCalculateDistance.mockReturnValue(150)

    const result = await checkGeofence(45.0, -93.0)

    expect(result.isWithinGeofence).toBe(false)
    expect(result.distanceMeters).toBe(150)
    expect(result.allowedRadiusMeters).toBe(15)
  })

  it('should round distance to nearest meter', async () => {
    mockCalculateDistance.mockReturnValue(45.7)
    mockIsWithinGeofence.mockReturnValue(true)

    const result = await checkGeofence(44.9778, -93.265)

    expect(result.distanceMeters).toBe(46)
  })
})
