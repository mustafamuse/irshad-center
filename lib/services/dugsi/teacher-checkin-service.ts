/**
 * Teacher Check-in Service
 *
 * Business logic for Dugsi teacher clock-in/clock-out operations.
 * Handles GPS geofencing validation, late detection, and admin overrides.
 */

import { Prisma } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import {
  isWithinGeofence,
  isLateForShift,
  isGeofenceConfigured,
  CHECKIN_ERROR_CODES,
  SCHOOL_TIMEZONE,
} from '@/lib/constants/teacher-checkin'
import { prisma } from '@/lib/db'
import {
  getCheckinById,
  isTeacherEnrolledInDugsi,
  getTeacherShifts,
  teacherCheckinInclude,
  TeacherCheckinWithRelations,
} from '@/lib/db/queries/teacher-checkin'
import { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import { ValidationError } from '@/lib/services/validation-service'
import type {
  AdminClockInInput,
  ClockInInput,
  ClockOutInput,
  UpdateCheckinInput,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-checkin')

export interface ClockInResult {
  checkIn: TeacherCheckinWithRelations
}

export interface ClockOutResult {
  checkIn: TeacherCheckinWithRelations
}

export async function clockIn(
  input: ClockInInput,
  client: DatabaseClient = prisma
): Promise<ClockInResult> {
  const { teacherId, shift, latitude, longitude } = input

  const isEnrolled = await isTeacherEnrolledInDugsi(teacherId, client)
  if (!isEnrolled) {
    throw new ValidationError(
      'Teacher is not enrolled in the Dugsi program',
      CHECKIN_ERROR_CODES.NOT_ENROLLED_IN_DUGSI,
      { teacherId }
    )
  }

  const teacherShifts = await getTeacherShifts(teacherId, client)
  if (!teacherShifts.includes(shift)) {
    throw new ValidationError(
      `Teacher is not assigned to the ${shift} shift`,
      CHECKIN_ERROR_CODES.INVALID_SHIFT,
      { teacherId, shift, assignedShifts: teacherShifts }
    )
  }

  const now = new Date()
  const dateOnly = new Date(
    formatInTimeZone(now, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  )

  if (!isGeofenceConfigured()) {
    throw new ValidationError(
      'Check-in system is not configured. Please contact administrator.',
      CHECKIN_ERROR_CODES.SYSTEM_NOT_CONFIGURED
    )
  }

  const clockInValid = isWithinGeofence(latitude, longitude)

  if (!clockInValid) {
    throw new ValidationError(
      'You must be at the center to check in. Please move closer and try again.',
      CHECKIN_ERROR_CODES.OUTSIDE_GEOFENCE,
      { latitude, longitude }
    )
  }

  const isLate = isLateForShift(now, shift)

  let checkIn: TeacherCheckinWithRelations

  try {
    checkIn = await client.dugsiTeacherCheckIn.create({
      data: {
        teacherId,
        date: dateOnly,
        shift,
        clockInTime: now,
        clockInLat: latitude,
        clockInLng: longitude,
        clockInValid,
        isLate,
      },
      include: teacherCheckinInclude,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ValidationError(
        'Teacher has already checked in for this shift today',
        CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN,
        { teacherId, shift, date: dateOnly.toISOString() }
      )
    }
    throw error
  }

  logger.info(
    {
      event: 'TEACHER_CLOCK_IN',
      checkInId: checkIn.id,
      teacherId,
      teacherName: checkIn.teacher.person.name,
      shift,
      isLate,
      clockInValid,
      timestamp: now.toISOString(),
    },
    `Teacher clocked in${isLate ? ' (LATE)' : ''}`
  )

  return { checkIn }
}

export async function adminClockIn(
  input: AdminClockInInput,
  client: DatabaseClient = prisma
): Promise<ClockInResult> {
  const { teacherId, shift, date, clockInTime } = input

  const isEnrolled = await isTeacherEnrolledInDugsi(teacherId, client)
  if (!isEnrolled) {
    throw new ValidationError(
      'Teacher is not enrolled in the Dugsi program',
      CHECKIN_ERROR_CODES.NOT_ENROLLED_IN_DUGSI,
      { teacherId }
    )
  }

  const teacherShifts = await getTeacherShifts(teacherId, client)
  if (!teacherShifts.includes(shift)) {
    throw new ValidationError(
      `Teacher is not assigned to the ${shift} shift`,
      CHECKIN_ERROR_CODES.INVALID_SHIFT,
      { teacherId, shift, assignedShifts: teacherShifts }
    )
  }

  const dateOnly = new Date(
    formatInTimeZone(date, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  )

  const isLate = isLateForShift(clockInTime, shift)

  let checkIn: TeacherCheckinWithRelations

  try {
    checkIn = await client.dugsiTeacherCheckIn.create({
      data: {
        teacherId,
        date: dateOnly,
        shift,
        clockInTime,
        clockInLat: null,
        clockInLng: null,
        clockInValid: true,
        isLate,
      },
      include: teacherCheckinInclude,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ValidationError(
        'Teacher has already checked in for this shift on this date',
        CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN,
        { teacherId, shift, date: dateOnly.toISOString() }
      )
    }
    throw error
  }

  logger.info(
    {
      event: 'ADMIN_CLOCK_IN',
      checkInId: checkIn.id,
      teacherId,
      teacherName: checkIn.teacher.person.name,
      shift,
      isLate,
      clockInTime: clockInTime.toISOString(),
      date: dateOnly.toISOString(),
    },
    `Admin clocked in teacher${isLate ? ' (LATE)' : ''}`
  )

  return { checkIn }
}

export async function clockOut(
  input: ClockOutInput,
  client: DatabaseClient = prisma
): Promise<ClockOutResult> {
  const { checkInId, latitude, longitude } = input

  const existingCheckin = await getCheckinById(checkInId, client)
  if (!existingCheckin) {
    throw new ValidationError(
      'Check-in record not found',
      CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
      { checkInId }
    )
  }

  if (existingCheckin.clockOutTime) {
    throw new ValidationError(
      'Teacher has already clocked out',
      CHECKIN_ERROR_CODES.ALREADY_CLOCKED_OUT,
      { checkInId, clockOutTime: existingCheckin.clockOutTime.toISOString() }
    )
  }

  const now = new Date()

  const checkIn = await client.dugsiTeacherCheckIn.update({
    where: { id: checkInId },
    data: {
      clockOutTime: now,
      clockOutLat: latitude ?? null,
      clockOutLng: longitude ?? null,
    },
    include: teacherCheckinInclude,
  })

  logger.info(
    {
      event: 'TEACHER_CLOCK_OUT',
      checkInId: checkIn.id,
      teacherId: checkIn.teacherId,
      teacherName: checkIn.teacher.person.name,
      shift: checkIn.shift,
      timestamp: now.toISOString(),
    },
    'Teacher clocked out'
  )

  return { checkIn }
}

export async function updateCheckin(
  input: UpdateCheckinInput,
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations> {
  const { checkInId, clockInTime, clockOutTime, isLate, clockInValid, notes } =
    input

  const existingCheckin = await getCheckinById(checkInId, client)
  if (!existingCheckin) {
    throw new ValidationError(
      'Check-in record not found',
      CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
      { checkInId }
    )
  }

  const updateData: Prisma.DugsiTeacherCheckInUpdateInput = {}

  if (clockInTime !== undefined) {
    updateData.clockInTime = clockInTime
  }
  if (clockOutTime !== undefined) {
    updateData.clockOutTime = clockOutTime
  }
  if (isLate !== undefined) {
    updateData.isLate = isLate
  }
  if (clockInValid !== undefined) {
    updateData.clockInValid = clockInValid
  }
  if (notes !== undefined) {
    updateData.notes = notes
  }

  const effectiveClockIn = clockInTime ?? existingCheckin.clockInTime
  const effectiveClockOut =
    clockOutTime !== undefined ? clockOutTime : existingCheckin.clockOutTime

  if (
    effectiveClockOut &&
    effectiveClockIn &&
    effectiveClockOut <= effectiveClockIn
  ) {
    throw new ValidationError(
      'Clock out time must be after clock in time',
      CHECKIN_ERROR_CODES.INVALID_TIME_ORDER,
      { clockInTime: effectiveClockIn, clockOutTime: effectiveClockOut }
    )
  }

  const checkIn = await client.dugsiTeacherCheckIn.update({
    where: { id: checkInId },
    data: updateData,
    include: teacherCheckinInclude,
  })

  logger.info(
    {
      event: 'CHECKIN_UPDATED',
      checkInId,
      teacherId: checkIn.teacherId,
      teacherName: checkIn.teacher.person.name,
      changes: Object.keys(updateData),
    },
    'Check-in record updated by admin'
  )

  return checkIn
}

export async function deleteCheckin(
  checkInId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  const existingCheckin = await getCheckinById(checkInId, client)
  if (!existingCheckin) {
    throw new ValidationError(
      'Check-in record not found',
      CHECKIN_ERROR_CODES.CHECKIN_NOT_FOUND,
      { checkInId }
    )
  }

  await client.dugsiTeacherCheckIn.delete({
    where: { id: checkInId },
  })

  logger.info(
    {
      event: 'CHECKIN_DELETED',
      checkInId,
      teacherId: existingCheckin.teacherId,
      teacherName: existingCheckin.teacher.person.name,
      date: existingCheckin.date.toISOString(),
      shift: existingCheckin.shift,
    },
    'Check-in record deleted by admin'
  )
}
