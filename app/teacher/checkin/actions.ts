'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import {
  AttendanceSource,
  Shift,
  TeacherAttendanceStatus,
} from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'

import {
  generateTeacherToken,
  verifyTeacherToken,
} from '@/lib/auth/teacher-session'
import {
  GEOFENCE_RADIUS_METERS,
  SCHOOL_TIMEZONE,
  IRSHAD_CENTER_LOCATION,
} from '@/lib/constants/teacher-checkin'
import {
  getTeacherAttendanceSummary,
  getMonthlyExcusedCount,
} from '@/lib/db/queries/teacher-attendance'
import {
  getCheckinHistory,
  getDugsiTeachersForDropdown,
  getTeacherCheckin,
} from '@/lib/db/queries/teacher-checkin'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { submitExcuse } from '@/lib/services/dugsi/excuse-service'
import { clockIn, clockOut } from '@/lib/services/dugsi/teacher-checkin-service'
import { calculateDistance } from '@/lib/services/geolocation-service'
import { ValidationError } from '@/lib/services/validation-service'
import { SubmitExcuseSchema } from '@/lib/validations/teacher-attendance'
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
  try {
    return await getDugsiTeachersForDropdown()
  } catch (error) {
    await logError(logger, error, 'getDugsiTeachers failed')
    throw new ActionError(
      'Failed to load teachers',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
  }
}

export async function getTeacherCurrentStatus(
  teacherId: string
): Promise<TeacherCurrentStatus> {
  const parsed = z.string().uuid().safeParse(teacherId)
  if (!parsed.success) {
    throw new ActionError(
      'Invalid teacher ID',
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }
  const now = new Date()
  const dateString = formatInTimeZone(now, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const dateOnly = new Date(dateString)

  try {
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
  } catch (error) {
    if (error instanceof ActionError) throw error
    await logError(logger, error, 'getTeacherCurrentStatus failed', {
      teacherId,
    })
    throw new ActionError(
      'Failed to load teacher status',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
  }
}

function revalidateCheckinPaths() {
  revalidatePath('/teacher/checkin')
  revalidatePath('/admin/dugsi/teacher-checkins')
}

async function rethrowCheckinError(
  error: unknown,
  context: string,
  userMessage: string
): Promise<never> {
  if (error instanceof ValidationError) {
    throw new ActionError(error.message, ERROR_CODES.VALIDATION_ERROR)
  }
  if (error instanceof ActionError) throw error
  await logError(logger, error, context)
  throw new ActionError(userMessage, ERROR_CODES.SERVER_ERROR, undefined, 500)
}

const _teacherClockInAction = rateLimitedActionClient
  .metadata({ actionName: 'teacherClockInAction' })
  .schema(ClockInSchema)
  .action(async ({ parsedInput }) => {
    try {
      const result = await clockIn(parsedInput)
      after(revalidateCheckinPaths)

      const status = await getTeacherCurrentStatus(parsedInput.teacherId)

      return {
        checkInId: result.checkIn.id,
        status,
        message: result.checkIn.isLate
          ? 'Clocked in (Late)'
          : 'Clocked in successfully',
      }
    } catch (error) {
      return rethrowCheckinError(
        error,
        'Clock-in failed',
        'Failed to clock in. Please try again.'
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
      after(revalidateCheckinPaths)

      const status = await getTeacherCurrentStatus(parsedInput.teacherId)

      return { status, message: 'Clocked out successfully' }
    } catch (error) {
      return rethrowCheckinError(
        error,
        'Clock-out failed',
        'Failed to clock out. Please try again.'
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
    logger.warn(
      { latitude, longitude },
      'Non-finite GPS coordinates received in checkGeofence'
    )
    return {
      isWithinGeofence: false,
      distanceMeters: -1,
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
    isWithinGeofence: distance <= GEOFENCE_RADIUS_METERS,
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

  try {
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
  } catch (error) {
    await logError(logger, error, 'getTeacherCheckinHistory failed', {
      teacherId,
    })
    throw new ActionError(
      'Failed to load check-in history',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
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
  source: AttendanceSource
  minutesLate: number | null
  clockInTime: Date | null
  pendingExcuseId: string | null
  wasExcuseRejected: boolean
}

export type AttendanceHistoryResult = {
  records: AttendanceHistoryItem[]
  monthlyExcuseCount: number
}

// teacherId is resolved from the signed session token; client-supplied value is ignored.
// IMPORTANT: keep unexported — all callers must go through _getTeacherAttendanceHistoryAction.
async function fetchAttendanceHistory(
  teacherId: string,
  weeksBack = 8
): Promise<AttendanceHistoryResult> {
  const today = new Date()

  // Anchor to school timezone — at 11 PM CST (5 AM Saturday UTC) `new Date()` is
  // already Saturday UTC, so a raw date arithmetic would shift the window one day
  // forward and include a future EXPECTED record. UTC noon anchor corrects this.
  const todayInTz = formatInTimeZone(today, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const [year, month] = todayInTz.split('-').map(Number)
  const todayAnchor = new Date(`${todayInTz}T12:00:00Z`)
  // Lower bound uses T00:00:00Z (not todayAnchor's T12:00:00Z): DATE columns store
  // midnight UTC, so a noon lower bound would exclude the oldest Saturday's record
  // when today is also a Saturday — 2026-02-14T00:00:00Z >= T12:00:00Z is false.
  const from = new Date(`${todayInTz}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - weeksBack * 7)

  const [records, monthlyExcuseCount] = await Promise.all([
    getTeacherAttendanceSummary(teacherId, from, todayAnchor),
    getMonthlyExcusedCount(teacherId, year, month),
  ])

  return {
    records: records.map((r) => ({
      id: r.id,
      date: formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd'),
      shift: r.shift,
      status: r.status,
      source: r.source,
      minutesLate: r.minutesLate,
      clockInTime: r.clockInTime,
      pendingExcuseId:
        r.excuses.find((e) => e.status === 'PENDING')?.id ?? null,
      wasExcuseRejected:
        !r.excuses.some(
          (e) => e.status === 'PENDING' || e.status === 'APPROVED'
        ) && r.excuses.some((e) => e.status === 'REJECTED'),
    })),
    monthlyExcuseCount,
  }
}

const _createTeacherSessionAction = rateLimitedActionClient
  .metadata({ actionName: 'createTeacherSessionAction' })
  .schema(z.object({ teacherId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const teachers = await getDugsiTeachersForDropdown()
    const found = teachers.find((t) => t.id === parsedInput.teacherId)
    if (!found) {
      throw new ActionError(
        'Teacher not found',
        ERROR_CODES.UNAUTHORIZED,
        undefined,
        401
      )
    }
    const token = generateTeacherToken(parsedInput.teacherId)
    return { token }
  })

export async function createTeacherSessionAction(
  ...args: Parameters<typeof _createTeacherSessionAction>
) {
  return _createTeacherSessionAction(...args)
}

const _getTeacherAttendanceHistoryAction = rateLimitedActionClient
  .metadata({ actionName: 'getTeacherAttendanceHistoryAction' })
  .schema(z.object({ teacherId: z.string().uuid(), token: z.string() }))
  .action(async ({ parsedInput }) => {
    const teacherId = verifyTeacherToken(parsedInput.token)
    if (!teacherId) {
      throw new ActionError(
        'Session expired. Please refresh and try again.',
        ERROR_CODES.UNAUTHORIZED,
        undefined,
        401
      )
    }
    try {
      return await fetchAttendanceHistory(teacherId)
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'fetchAttendanceHistory failed', {
        teacherId,
      })
      throw new ActionError(
        'Failed to load attendance history',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function getTeacherAttendanceHistory(
  ...args: Parameters<typeof _getTeacherAttendanceHistoryAction>
) {
  return _getTeacherAttendanceHistoryAction(...args)
}

const _submitExcuseAction = rateLimitedActionClient
  .metadata({ actionName: 'submitExcuseAction' })
  .schema(SubmitExcuseSchema)
  .action(async ({ parsedInput }) => {
    const { attendanceRecordId, token, reason } = parsedInput

    // teacherId is resolved from the signed session token; client-supplied value is ignored
    const teacherId = verifyTeacherToken(token)
    if (!teacherId) {
      throw new ActionError(
        'Session expired. Please refresh and try again.',
        ERROR_CODES.UNAUTHORIZED,
        undefined,
        401
      )
    }

    try {
      const excuse = await submitExcuse({
        attendanceRecordId,
        teacherId,
        reason,
      })
      after(() => revalidatePath('/teacher/checkin'))
      return { excuseRequestId: excuse.id }
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'submitExcuse failed', {
        attendanceRecordId,
        teacherId,
      })
      throw new ActionError(
        'Failed to submit excuse. Please try again.',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function submitExcuseAction(
  ...args: Parameters<typeof _submitExcuseAction>
) {
  return _submitExcuseAction(...args)
}
