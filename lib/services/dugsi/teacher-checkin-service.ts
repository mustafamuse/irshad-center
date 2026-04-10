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
  isGeofenceConfigured,
  CHECKIN_ERROR_CODES,
  SCHOOL_TIMEZONE,
} from '@/lib/constants/teacher-checkin'
import { evaluateCheckIn } from '@/lib/utils/evaluate-checkin'
import { assertValidTransition } from '@/lib/utils/attendance-transitions'
import { prisma } from '@/lib/db'
import {
  getCheckinById,
  isTeacherEnrolledInDugsi,
  getTeacherShifts,
  getTeacherCheckin,
  teacherCheckinInclude,
  TeacherCheckinWithRelations,
} from '@/lib/db/queries/teacher-checkin'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
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

  const { isLate, minutesLate } = evaluateCheckIn({ clockInTimeUtc: now, shift })

  // Pre-validate duplicate before opening the transaction (project rule: check before write)
  const existingCheckin = await getTeacherCheckin(teacherId, dateOnly, shift, client)
  if (existingCheckin) {
    throw new ValidationError(
      'Teacher has already checked in for this shift today',
      CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN,
      { teacherId, shift, date: dateOnly.toISOString() }
    )
  }

  // Atomically write both the fact-log row and the attendance record
  const doWrites = async (tx: DatabaseClient) => {
    const checkInRecord = await tx.dugsiTeacherCheckIn.create({
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

    // Validate transition and write attendance record with optimistic lock — mirrors adminCheckIn.
    const existingAttendanceRecord = await tx.teacherAttendanceRecord.findUnique({
      where: { teacherId_date_shift: { teacherId, date: dateOnly, shift } },
      select: { status: true },
    })

    const attendanceData = {
      status: (isLate ? 'LATE' : 'PRESENT') as 'LATE' | 'PRESENT',
      source: 'SELF_CHECKIN' as const,
      checkInId: checkInRecord.id,
      clockInTime: now,
      minutesLate: isLate ? minutesLate : null,
    }

    if (existingAttendanceRecord) {
      if (existingAttendanceRecord.status === 'CLOSED') {
        throw new ValidationError(
          'School is closed today — please contact an admin to record your attendance',
          CHECKIN_ERROR_CODES.SCHOOL_CLOSED,
          { teacherId, shift }
        )
      }
      assertValidTransition(existingAttendanceRecord.status, attendanceData.status)
      // Include current status in WHERE: if a concurrent override already changed
      // the status, count=0 → throw rather than silently stomp the new state.
      const updateResult = await tx.teacherAttendanceRecord.updateMany({
        where: { teacherId, date: dateOnly, shift, status: existingAttendanceRecord.status },
        data: attendanceData,
      })
      if (updateResult.count === 0) {
        throw new ValidationError(
          'Attendance record was modified concurrently — please try again',
          CHECKIN_ERROR_CODES.CONCURRENT_MODIFICATION,
          { teacherId, shift }
        )
      }
    } else {
      // No pre-existing record: guard against a closed date where generateExpectedSlots
      // was never run (so there's no CLOSED record to trigger the check above).
      const closure = await tx.schoolClosure.findUnique({ where: { date: dateOnly } })
      if (closure) {
        throw new ValidationError(
          'School is closed today — please contact an admin to record your attendance',
          CHECKIN_ERROR_CODES.SCHOOL_CLOSED,
          { teacherId, shift }
        )
      }
      await tx.teacherAttendanceRecord.create({
        data: { teacherId, date: dateOnly, shift, ...attendanceData },
      })
    }

    return checkInRecord
  }

  let checkIn: TeacherCheckinWithRelations
  try {
    checkIn = isPrismaClient(client)
      ? await client.$transaction(doWrites)
      : await doWrites(client)
  } catch (error) {
    // A concurrent clockIn that slipped through the pre-flight check will cause a
    // P2002 unique-constraint violation on DugsiTeacherCheckIn(teacherId, date, shift).
    // Catch it OUTSIDE the transaction (project rule: never catch P2002 inside $transaction)
    // and remap to the user-facing DUPLICATE_CHECKIN error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ValidationError(
        'Teacher has already checked in for this shift today',
        CHECKIN_ERROR_CODES.DUPLICATE_CHECKIN,
        { teacherId, shift }
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

  const doWrites = async (tx: DatabaseClient) => {
    const checkIn = await tx.dugsiTeacherCheckIn.update({
      where: { id: checkInId },
      data: updateData,
      include: teacherCheckinInclude,
    })

    // Sync the linked TeacherAttendanceRecord when clockInTime or isLate changes.
    // The record may not exist (e.g. backfill hasn't run), so updateMany is used —
    // 0 matched rows is silently acceptable; we're not creating a new record here.
    // Status guard (PRESENT, LATE) prevents touching EXCUSED/ABSENT records where
    // the clock-in is no longer the authoritative source of status.
    const syncClockIn = clockInTime !== undefined
    const syncStatus = isLate !== undefined
    if (syncClockIn || syncStatus) {
      const effectiveIsLate = isLate ?? existingCheckin.isLate
      const effectiveClockInTime = clockInTime ?? existingCheckin.clockInTime
      // Re-derive minutesLate from the effective clock-in time — avoids silently erasing
      // precise lateness (e.g. 12 min) when an admin edits a field other than isLate.
      const { minutesLate: recomputedMinutesLate } = evaluateCheckIn({
        clockInTimeUtc: effectiveClockInTime,
        shift: existingCheckin.shift,
      })
      await tx.teacherAttendanceRecord.updateMany({
        where: { checkInId, status: { in: ['PRESENT', 'LATE'] } },
        data: {
          ...(syncClockIn ? { clockInTime } : {}),
          ...(syncStatus
            ? {
                status: effectiveIsLate ? 'LATE' : 'PRESENT',
                minutesLate: effectiveIsLate ? recomputedMinutesLate : null,
                source: 'ADMIN_OVERRIDE',
              }
            : {}),
        },
      })
    }

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

  return isPrismaClient(client)
    ? client.$transaction(doWrites)
    : doWrites(client)
}

export async function deleteCheckin(
  checkInId: string,
  changedBy?: string,
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

  const { teacherId, date, shift } = existingCheckin

  const doWrites = async (tx: DatabaseClient) => {
    // Step 1: Release the RESTRICT FK on ANY record still pointing at this check-in,
    // regardless of status.  EXCUSED and admin-overridden ABSENT records legitimately
    // carry a non-null checkInId (neither approveExcuse nor transitionStatus clears it),
    // so the status-filtered updateMany below would leave their FK live and the DELETE
    // would throw P2003.  clockInTime and minutesLate originate from the check-in row
    // and are meaningless once it's gone, so clear them here too.
    await tx.teacherAttendanceRecord.updateMany({
      where: { checkInId },
      data: { checkInId: null, clockInTime: null, minutesLate: null, changedBy: changedBy ?? null },
    })

    // Step 2: Revert PRESENT/LATE → ABSENT.  EXCUSED and overridden-ABSENT records are
    // intentionally left at their current status — the teacher did show up, and an admin
    // action already determined the outcome.
    // ABSENT (not EXPECTED) is intentional: the check-in existed, proving the teacher
    // attempted to sign in. Deleting it means the attendance outcome is now unknown —
    // ABSENT is the conservative fallback. EXPECTED would imply the window is still open
    // for a fresh clock-in, which may no longer be true (e.g. post-cutoff deletion).
    // UI callers should warn the admin before confirming the delete.
    // The @@unique([teacherId, date, shift]) constraint guarantees at most one row,
    // so count > 1 would indicate a data integrity problem.
    // Assert both reachable transitions are still valid — guards against silent
    // breakage if ALLOWED_TRANSITIONS is tightened in the future.
    assertValidTransition('PRESENT', 'ABSENT')
    assertValidTransition('LATE', 'ABSENT')
    const revertResult = await tx.teacherAttendanceRecord.updateMany({
      where: { teacherId, date, shift, status: { in: ['PRESENT', 'LATE'] } },
      data: { status: 'ABSENT', source: 'ADMIN_OVERRIDE', changedBy: changedBy ?? null },
    })
    if (revertResult.count > 1) {
      logger.warn({ teacherId, date, shift }, 'deleteCheckin: unexpectedly reverted multiple attendance records')
    }

    await tx.dugsiTeacherCheckIn.delete({ where: { id: checkInId } })
  }

  await (isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client))

  logger.info(
    {
      event: 'CHECKIN_DELETED',
      checkInId,
      teacherId,
      teacherName: existingCheckin.teacher.person.name,
      date: date.toISOString(),
      shift,
    },
    'Check-in record deleted by admin'
  )
}
