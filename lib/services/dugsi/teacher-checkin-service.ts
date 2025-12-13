import { Shift } from '@prisma/client'

import {
  CHECKIN_WINDOW,
  DUGSI_CENTER_COORDINATES,
  GEOFENCE_RADIUS_METERS,
  MAX_SHIFT_HOURS,
  NO_SHOW_THRESHOLD_MINUTES,
  SHIFT_START_TIMES,
  LATE_GRACE_PERIOD_MINUTES,
} from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getTeacherCheckIn,
  getTeacherCheckInById,
} from '@/lib/db/queries/dugsi-teacher-checkin'
import type { DatabaseClient } from '@/lib/db/types'
import {
  ActionError,
  ERROR_CODES,
  notFoundError,
} from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import type { ClockInInput, ClockOutInput } from '@/lib/types/dugsi-attendance'
import { isWithinGeofence } from '@/lib/utils/geolocation'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createServiceLogger('dugsi-teacher-checkin')

function getShiftStartTime(shift: Shift, date: Date): Date {
  const shiftConfig = SHIFT_START_TIMES[shift]
  const shiftStart = new Date(date)
  shiftStart.setHours(shiftConfig.hour, shiftConfig.minute, 0, 0)
  return shiftStart
}

function isLateForShift(shift: Shift, clockInTime: Date): boolean {
  const shiftStart = getShiftStartTime(shift, clockInTime)
  const graceEndTime = new Date(shiftStart)
  graceEndTime.setMinutes(graceEndTime.getMinutes() + LATE_GRACE_PERIOD_MINUTES)
  return clockInTime > graceEndTime
}

export type CheckInWindowStatus = {
  canCheckIn: boolean
  reason?: 'too_early' | 'too_late'
  windowOpensAt?: Date
  windowClosedAt?: Date
}

export function getCheckInWindowStatus(
  shift: Shift,
  now: Date = new Date()
): CheckInWindowStatus {
  const shiftStart = getShiftStartTime(shift, now)

  const windowStart = new Date(shiftStart)
  windowStart.setMinutes(
    windowStart.getMinutes() - CHECKIN_WINDOW.MINUTES_BEFORE
  )

  const windowEnd = new Date(shiftStart)
  windowEnd.setMinutes(windowEnd.getMinutes() + CHECKIN_WINDOW.MINUTES_AFTER)

  if (now < windowStart) {
    return {
      canCheckIn: false,
      reason: 'too_early',
      windowOpensAt: windowStart,
    }
  }

  if (now > windowEnd) {
    return { canCheckIn: false, reason: 'too_late', windowClosedAt: windowEnd }
  }

  return { canCheckIn: true }
}

export async function clockIn(
  input: ClockInInput,
  client: DatabaseClient = prisma
) {
  const validated = ClockInSchema.parse(input)
  const { teacherId, shift, lat, lng } = validated

  const teacher = await client.teacher.findUnique({
    where: { id: teacherId },
    include: {
      programs: {
        where: { program: 'DUGSI_PROGRAM', isActive: true },
      },
    },
  })

  if (!teacher) {
    throw notFoundError('Teacher', ERROR_CODES.NOT_FOUND)
  }

  const dugsiProgram = teacher.programs.find(
    (p) => p.program === 'DUGSI_PROGRAM'
  )
  if (!dugsiProgram) {
    throw new ActionError(
      'Teacher is not authorized for Dugsi program',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  if (dugsiProgram.shifts.length === 0) {
    throw new ActionError(
      'Teacher has no assigned shifts for Dugsi program',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  if (!dugsiProgram.shifts.includes(shift)) {
    throw new ActionError(
      `Teacher is not assigned to the ${shift.toLowerCase()} shift`,
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const now = new Date()
  const windowStatus = getCheckInWindowStatus(shift, now)
  if (!windowStatus.canCheckIn) {
    if (windowStatus.reason === 'too_early') {
      throw new ActionError(
        `Check-in window opens at ${windowStatus.windowOpensAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }
    throw new ActionError(
      'Check-in window has closed for this shift',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existingCheckIn = await getTeacherCheckIn(
    teacherId,
    today,
    shift,
    client
  )
  if (existingCheckIn) {
    throw new ActionError(
      'Already clocked in for this shift today',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const clockInValid = isWithinGeofence(
    { lat, lng },
    DUGSI_CENTER_COORDINATES,
    GEOFENCE_RADIUS_METERS
  )

  const clockInTime = new Date()
  const isLate = isLateForShift(shift, clockInTime)

  logger.info(
    {
      teacherId,
      shift,
      clockInValid,
      isLate,
      lat,
      lng,
    },
    'Teacher clocking in'
  )

  const checkIn = await client.dugsiTeacherCheckIn.create({
    data: {
      teacherId,
      date: today,
      shift,
      clockInTime,
      clockInLat: lat,
      clockInLng: lng,
      clockInValid,
      isLate,
    },
  })

  logger.info({ checkInId: checkIn.id }, 'Teacher clock-in created')

  return {
    checkInId: checkIn.id,
    clockInValid,
    isLate,
    clockInTime,
  }
}

export async function clockOut(
  input: ClockOutInput,
  client: DatabaseClient = prisma
) {
  const validated = ClockOutSchema.parse(input)
  const { checkInId, lat, lng } = validated

  const checkIn = await getTeacherCheckInById(checkInId, client)
  if (!checkIn) {
    throw notFoundError('Check-in record', ERROR_CODES.NOT_FOUND)
  }

  if (checkIn.clockOutTime) {
    throw new ActionError('Already clocked out', ERROR_CODES.VALIDATION_ERROR)
  }

  const clockOutTime = new Date()

  logger.info(
    { checkInId, teacherId: checkIn.teacherId },
    'Teacher clocking out'
  )

  const updated = await client.dugsiTeacherCheckIn.update({
    where: { id: checkInId },
    data: {
      clockOutTime,
      ...(lat !== undefined && { clockOutLat: lat }),
      ...(lng !== undefined && { clockOutLng: lng }),
    },
  })

  logger.info({ checkInId }, 'Teacher clock-out recorded')

  return {
    checkInId: updated.id,
    clockOutTime: updated.clockOutTime,
  }
}

export async function getTeacherShifts(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<Shift[]> {
  const teacher = await client.teacher.findUnique({
    where: { id: teacherId },
    include: {
      programs: {
        where: { program: 'DUGSI_PROGRAM', isActive: true },
        select: { shifts: true },
      },
    },
  })

  if (!teacher || teacher.programs.length === 0) {
    return []
  }

  return teacher.programs[0].shifts
}

export async function autoClockOutStaleCheckIns(
  client: DatabaseClient = prisma
): Promise<number> {
  const maxShiftMs = MAX_SHIFT_HOURS * 60 * 60 * 1000
  const cutoffTime = new Date(Date.now() - maxShiftMs)

  const staleCheckIns = await client.dugsiTeacherCheckIn.findMany({
    where: {
      clockOutTime: null,
      clockInTime: { lt: cutoffTime },
    },
  })

  if (staleCheckIns.length === 0) {
    return 0
  }

  logger.info(
    { count: staleCheckIns.length },
    'Auto-clocking out stale check-ins'
  )

  await Promise.all(
    staleCheckIns.map((checkIn) => {
      const autoClockOutTime = new Date(checkIn.clockInTime)
      autoClockOutTime.setHours(autoClockOutTime.getHours() + MAX_SHIFT_HOURS)

      return client.dugsiTeacherCheckIn.update({
        where: { id: checkIn.id },
        data: {
          clockOutTime: autoClockOutTime,
          notes: 'Auto clock-out: exceeded maximum shift duration',
        },
      })
    })
  )

  logger.info({ count: staleCheckIns.length }, 'Auto clock-out completed')

  return staleCheckIns.length
}

export interface AdminClockInInput {
  teacherId: string
  shift: Shift
  reason: string
}

export async function adminClockIn(
  input: AdminClockInInput,
  client: DatabaseClient = prisma
) {
  const { teacherId, shift, reason } = input

  if (!reason || reason.trim().length < 3) {
    throw new ActionError(
      'A reason is required for manual check-in',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const teacher = await client.teacher.findUnique({
    where: { id: teacherId },
    include: {
      programs: {
        where: { program: 'DUGSI_PROGRAM', isActive: true },
      },
    },
  })

  if (!teacher) {
    throw notFoundError('Teacher', ERROR_CODES.NOT_FOUND)
  }

  const dugsiProgram = teacher.programs.find(
    (p) => p.program === 'DUGSI_PROGRAM'
  )
  if (!dugsiProgram || !dugsiProgram.shifts.includes(shift)) {
    throw new ActionError(
      'Teacher is not assigned to this shift',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existingCheckIn = await getTeacherCheckIn(
    teacherId,
    today,
    shift,
    client
  )
  if (existingCheckIn) {
    throw new ActionError(
      'Already has a check-in for this shift today',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  const clockInTime = new Date()
  const isLate = isLateForShift(shift, clockInTime)

  logger.info({ teacherId, shift, reason, isLate }, 'Admin manual check-in')

  const checkIn = await client.dugsiTeacherCheckIn.create({
    data: {
      teacherId,
      date: today,
      shift,
      clockInTime,
      clockInValid: false,
      isLate,
      notes: `Manual check-in: ${reason.trim()}`,
    },
  })

  return {
    checkInId: checkIn.id,
    clockInTime,
    isLate,
  }
}

export interface NoShowTeacher {
  teacherId: string
  teacherName: string
  shift: Shift
  shiftStartTime: Date
}

export async function getNoShowTeachers(
  shift: Shift,
  date: Date = new Date(),
  client: DatabaseClient = prisma
): Promise<NoShowTeacher[]> {
  const today = new Date(date)
  today.setHours(0, 0, 0, 0)

  const shiftStart = getShiftStartTime(shift, date)
  const noShowThreshold = new Date(shiftStart)
  noShowThreshold.setMinutes(
    noShowThreshold.getMinutes() + NO_SHOW_THRESHOLD_MINUTES
  )

  const now = new Date()
  if (now < noShowThreshold) {
    return []
  }

  const teachersWithShift = await client.teacher.findMany({
    where: {
      programs: {
        some: {
          program: 'DUGSI_PROGRAM',
          isActive: true,
          shifts: { has: shift },
        },
      },
    },
    include: {
      person: { select: { name: true } },
    },
  })

  const checkIns = await client.dugsiTeacherCheckIn.findMany({
    where: {
      date: today,
      shift,
      teacherId: { in: teachersWithShift.map((t) => t.id) },
    },
    select: { teacherId: true },
  })

  const checkedInTeacherIds = new Set(checkIns.map((c) => c.teacherId))

  return teachersWithShift
    .filter((t) => !checkedInTeacherIds.has(t.id))
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.person.name,
      shift,
      shiftStartTime: shiftStart,
    }))
}
