'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

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
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { clockIn, clockOut } from '@/lib/services/dugsi/teacher-checkin-service'
import { calculateDistance } from '@/lib/services/geolocation-service'
import { ValidationError } from '@/lib/services/validation-service'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-checkin-actions')

export type TeacherForDropdown = Awaited<
  ReturnType<typeof getDugsiTeachersForDropdown>
>[number]

export type TeacherCurrentStatus = {
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

const _teacherClockInAction = rateLimitedActionClient
  .metadata({ actionName: 'teacherClockInAction' })
  .schema(ClockInSchema)
  .action(async ({ parsedInput }) => {
    try {
      const result = await clockIn(parsedInput)
      revalidatePath('/teacher/checkin')
      revalidatePath('/admin/dugsi/teacher-checkins')

      const status = await getTeacherCurrentStatus(parsedInput.teacherId)

      return {
        checkInId: result.checkIn.id,
        status,
        message: result.checkIn.isLate
          ? 'Clocked in (Late)'
          : 'Clocked in successfully',
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ActionError(error.message, ERROR_CODES.VALIDATION_ERROR)
      }
      await logError(logger, error, 'Clock-in failed')
      throw new ActionError(
        'Failed to clock in. Please try again.',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function teacherClockInAction(
  ...args: Parameters<typeof _teacherClockInAction>
) {
  return _teacherClockInAction(...args)
}

const _teacherClockOutAction = rateLimitedActionClient
  .metadata({ actionName: 'teacherClockOutAction' })
  .schema(ClockOutSchema)
  .action(async ({ parsedInput }) => {
    try {
      await clockOut(parsedInput)
      revalidatePath('/teacher/checkin')
      revalidatePath('/admin/dugsi/teacher-checkins')

      const status = await getTeacherCurrentStatus(parsedInput.teacherId)

      return { status, message: 'Clocked out successfully' }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ActionError(error.message, ERROR_CODES.VALIDATION_ERROR)
      }
      await logError(logger, error, 'Clock-out failed')
      throw new ActionError(
        'Failed to clock out. Please try again.',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function teacherClockOutAction(
  ...args: Parameters<typeof _teacherClockOutAction>
) {
  return _teacherClockOutAction(...args)
}

export type GeofenceCheckResult = {
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

export type CheckinHistoryItem = {
  id: string
  date: string
  shift: Shift
  clockInTime: Date
  clockOutTime: Date | null
  isLate: boolean
}

export type CheckinHistoryResult = {
  data: CheckinHistoryItem[]
  total: number
}

export async function getTeacherCheckinHistory(
  teacherId: string
): Promise<CheckinHistoryResult> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const result = await getCheckinHistory(
    { teacherId, dateFrom: thirtyDaysAgo },
    { page: 1, limit: 10 }
  )

  return {
    data: result.data.map((item) => ({
      id: item.id,
      date: item.date.toISOString().split('T')[0],
      shift: item.shift,
      clockInTime: item.clockInTime,
      clockOutTime: item.clockOutTime,
      isLate: item.isLate,
    })),
    total: result.total,
  }
}
