'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { Shift, TeacherAttendanceStatus } from '@prisma/client'
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
import {
  getTeacherAttendanceSummary,
  getMonthlyExcuseCount,
  getAttendanceRecordStatus,
} from '@/lib/db/queries/teacher-attendance'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { clockIn, clockOut } from '@/lib/services/dugsi/teacher-checkin-service'
import { submitExcuse } from '@/lib/services/dugsi/excuse-service'
import { calculateDistance } from '@/lib/services/geolocation-service'
import { ValidationError } from '@/lib/services/validation-service'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/teacher-checkin'
import { SubmitExcuseSchema } from '@/lib/validations/teacher-attendance'

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
      after(() => {
        revalidatePath('/teacher/checkin')
        revalidatePath('/admin/dugsi/teacher-checkins')
      })

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
      after(() => {
        revalidatePath('/teacher/checkin')
        revalidatePath('/admin/dugsi/teacher-checkins')
      })

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

// ============================================================================
// PHASE 2: ATTENDANCE STATUS HISTORY + EXCUSE SUBMISSION
// ============================================================================

export type AttendanceHistoryItem = {
  id: string
  date: string
  shift: Shift
  status: TeacherAttendanceStatus
  minutesLate: number | null
  clockInTime: Date | null
  pendingExcuseId: string | null // non-null if there's a PENDING excuse request
}

export type AttendanceHistoryResult = {
  records: AttendanceHistoryItem[]
  monthlyExcuseCount: number
}

export async function getTeacherAttendanceHistory(
  teacherId: string,
  weeksBack = 8
): Promise<AttendanceHistoryResult> {
  const today = new Date()
  const from = new Date(today)
  from.setUTCDate(from.getUTCDate() - weeksBack * 7)

  // Extract year/month in school timezone — server runs UTC; at 7 PM CST Vercel's
  // clock already reads the next calendar day, which would query the wrong month.
  const todayInTz = formatInTimeZone(today, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const [year, month] = todayInTz.split('-').map(Number)

  const [records, monthlyExcuseCount] = await Promise.all([
    getTeacherAttendanceSummary(teacherId, from, today),
    getMonthlyExcuseCount(teacherId, year, month),
  ])

  return {
    records: records.map((r) => ({
      id: r.id,
      date: formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd'),
      shift: r.shift,
      status: r.status,
      minutesLate: r.minutesLate,
      clockInTime: r.clockInTime,
      pendingExcuseId:
        r.excuses.find((e) => e.status === 'PENDING')?.id ?? null,
    })),
    monthlyExcuseCount,
  }
}

const _submitExcuseAction = rateLimitedActionClient
  .metadata({ actionName: 'submitExcuseAction' })
  .schema(SubmitExcuseSchema)
  .action(async ({ parsedInput }) => {
    const { attendanceRecordId, teacherId, reason } = parsedInput

    // SECURITY — ownership boundary (BLOCKING pre-production: see #225):
    // The teacher app has no session; teachers identify only by UI selection.
    // Concrete risk: Teacher A selects Teacher B in the dropdown, copies
    // attendanceRecordId from the DOM, and submits an excuse for Teacher B's record.
    // The teacherId cross-check below only proves the two supplied values are
    // self-consistent — both are unauthenticated HTML values from the same page.
    // This feature MUST NOT ship to production until #225 is resolved.
    // Full fix (tracked in #225):
    //   - Sign (attendanceRecordId, teacherId, action, exp) with EXCUSE_TOKEN_SECRET on page render
    //     (include the action type so the token can't be replayed against a different endpoint)
    //   - 30-min TTL; add token field to SubmitExcuseSchema; verify before DB lookup
    // Do NOT remove this comment block until #225 is closed.
    const record = await getAttendanceRecordStatus(attendanceRecordId)
    if (!record) {
      throw new ActionError('Attendance record not found', ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND, undefined, 404)
    }
    if (record.teacherId !== teacherId) {
      throw new ActionError('Attendance record does not belong to this teacher', ERROR_CODES.EXCUSE_NOT_ELIGIBLE, undefined, 403)
    }

    const excuse = await submitExcuse({ attendanceRecordId, teacherId, reason })

    after(() => revalidatePath('/teacher/checkin'))
    return { excuseRequestId: excuse.id }
  })

export async function submitExcuseAction(
  ...args: Parameters<typeof _submitExcuseAction>
) {
  return _submitExcuseAction(...args)
}
