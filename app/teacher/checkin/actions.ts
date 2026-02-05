'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  GEOFENCE_RADIUS_METERS,
  isWithinGeofence,
  SCHOOL_TIMEZONE,
  IRSHAD_CENTER_LOCATION,
} from '@/lib/constants/teacher-checkin'
import {
  getCheckinHistory,
  getDugsiTeachersForDropdown,
  getTeacherCheckin,
} from '@/lib/db/queries/teacher-checkin'
import { createServiceLogger, logError } from '@/lib/logger'
import { clockIn, clockOut } from '@/lib/services/dugsi/teacher-checkin-service'
import { calculateDistance } from '@/lib/services/geolocation-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ActionResult } from '@/lib/utils/action-helpers'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-checkin-actions')

export type TeacherForDropdown = Awaited<
  ReturnType<typeof getDugsiTeachersForDropdown>
>[number]

export interface TeacherCurrentStatus {
  morningCheckinId: string | null
  morningClockInTime: Date | null
  morningClockOutTime: Date | null
  afternoonCheckinId: string | null
  afternoonClockInTime: Date | null
  afternoonClockOutTime: Date | null
}

export async function getDugsiTeachers(): Promise<TeacherForDropdown[]> {
  return getDugsiTeachersForDropdown()
}

export async function getTeacherCurrentStatus(
  teacherId: string
): Promise<TeacherCurrentStatus> {
  const now = new Date()
  const dateString = formatInTimeZone(now, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const dateOnly = new Date(dateString)

  const [morningCheckin, afternoonCheckin] = await Promise.all([
    getTeacherCheckin(teacherId, dateOnly, Shift.MORNING),
    getTeacherCheckin(teacherId, dateOnly, Shift.AFTERNOON),
  ])

  return {
    morningCheckinId: morningCheckin?.id ?? null,
    morningClockInTime: morningCheckin?.clockInTime ?? null,
    morningClockOutTime: morningCheckin?.clockOutTime ?? null,
    afternoonCheckinId: afternoonCheckin?.id ?? null,
    afternoonClockInTime: afternoonCheckin?.clockInTime ?? null,
    afternoonClockOutTime: afternoonCheckin?.clockOutTime ?? null,
  }
}

export async function teacherClockInAction(
  input: unknown
): Promise<ActionResult<{ checkInId: string; status: TeacherCurrentStatus }>> {
  try {
    const validated = ClockInSchema.parse(input)
    const authenticatedTeacherId = await getAuthenticatedTeacherId()
    const result = await clockIn({
      ...validated,
      teacherId: authenticatedTeacherId,
    })
    revalidatePath('/teacher/checkin')
    revalidatePath('/admin/dugsi/teacher-checkins')

    const status = await getTeacherCurrentStatus(authenticatedTeacherId)

    return {
      success: true,
      data: { checkInId: result.checkIn.id, status },
      message: result.checkIn.isLate
        ? 'Clocked in (Late)'
        : 'Clocked in successfully',
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      }
    }

    await logError(logger, error, 'Clock-in failed')
    return {
      success: false,
      error: 'Failed to clock in. Please try again.',
    }
  }
}

export async function teacherClockOutAction(
  input: unknown
): Promise<ActionResult<{ status: TeacherCurrentStatus }>> {
  try {
    const validated = ClockOutSchema.parse(input)
    const authenticatedTeacherId = await getAuthenticatedTeacherId()
    await clockOut({ ...validated, teacherId: authenticatedTeacherId })
    revalidatePath('/teacher/checkin')
    revalidatePath('/admin/dugsi/teacher-checkins')

    const status = await getTeacherCurrentStatus(authenticatedTeacherId)

    return {
      success: true,
      data: { status },
      message: 'Clocked out successfully',
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      }
    }

    await logError(logger, error, 'Clock-out failed')
    return {
      success: false,
      error: 'Failed to clock out. Please try again.',
    }
  }
}

export interface GeofenceCheckResult {
  isWithinGeofence: boolean
  distanceMeters: number
  allowedRadiusMeters: number
}

export async function checkGeofence(
  latitude: number,
  longitude: number
): Promise<GeofenceCheckResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      isWithinGeofence: false,
      distanceMeters: 0,
      allowedRadiusMeters: GEOFENCE_RADIUS_METERS,
    }
  }

  const distance = calculateDistance(
    latitude,
    longitude,
    IRSHAD_CENTER_LOCATION.lat,
    IRSHAD_CENTER_LOCATION.lng
  )

  return {
    isWithinGeofence: isWithinGeofence(latitude, longitude),
    distanceMeters: Math.round(distance),
    allowedRadiusMeters: GEOFENCE_RADIUS_METERS,
  }
}

export interface CheckinHistoryItem {
  id: string
  date: Date
  shift: Shift
  clockInTime: Date
  clockOutTime: Date | null
  isLate: boolean
}

export interface CheckinHistoryResult {
  data: CheckinHistoryItem[]
  total: number
}

export async function getTeacherCheckinHistory(): Promise<
  ActionResult<CheckinHistoryResult>
> {
  try {
    const teacherId = await getAuthenticatedTeacherId()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await getCheckinHistory(
      { teacherId, dateFrom: thirtyDaysAgo },
      { page: 1, limit: 10 }
    )

    return {
      success: true,
      data: {
        data: result.data.map((item) => ({
          id: item.id,
          date: item.date,
          shift: item.shift,
          clockInTime: item.clockInTime,
          clockOutTime: item.clockOutTime,
          isLate: item.isLate,
        })),
        total: result.total,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch check-in history')
    return {
      success: false,
      error: 'Failed to load check-in history',
    }
  }
}
