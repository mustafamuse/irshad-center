import { Shift } from '@prisma/client'

import {
  DUGSI_CENTER_COORDINATES,
  GEOFENCE_RADIUS_METERS,
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

function isLateForShift(shift: Shift, clockInTime: Date): boolean {
  const shiftConfig = SHIFT_START_TIMES[shift]
  const shiftStart = new Date(clockInTime)
  shiftStart.setHours(shiftConfig.hour, shiftConfig.minute, 0, 0)

  const graceEndTime = new Date(shiftStart)
  graceEndTime.setMinutes(graceEndTime.getMinutes() + LATE_GRACE_PERIOD_MINUTES)

  return clockInTime > graceEndTime
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
