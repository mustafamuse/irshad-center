/**
 * Teacher Check-in Service
 *
 * Business logic for Dugsi teacher clock-in/clock-out operations.
 * Handles GPS geofencing validation, late detection, and admin overrides.
 */

import { Prisma } from '@prisma/client'

import {
  isWithinGeofence,
  isLateForShift,
  CHECKIN_ERROR_CODES,
} from '@/lib/constants/teacher-checkin'
import { prisma } from '@/lib/db'
import {
  getCheckinById,
  isTeacherEnrolledInDugsi,
  getTeacherShifts,
  TeacherCheckinWithRelations,
} from '@/lib/db/queries/teacher-checkin'
import { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import { ValidationError } from '@/lib/services/validation-service'
import type {
  ClockInInput,
  ClockOutInput,
  UpdateCheckinInput,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-checkin')

export interface ClockInResult {
  checkIn: TeacherCheckinWithRelations
  isLate: boolean
  clockInValid: boolean
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
  const dateOnly = new Date(now.toISOString().split('T')[0])

  const clockInValid = isWithinGeofence(latitude, longitude)
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
      include: {
        teacher: {
          include: {
            person: {
              include: {
                contactPoints: true,
              },
            },
          },
        },
      },
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

  return { checkIn, isLate, clockInValid }
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
    include: {
      teacher: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
    },
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

  const checkIn = await client.dugsiTeacherCheckIn.update({
    where: { id: checkInId },
    data: updateData,
    include: {
      teacher: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
    },
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
