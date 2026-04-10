/**
 * Auto-mark Service
 *
 * Marks EXPECTED attendance records as LATE when the auto-mark window has passed.
 * Window = class start time + N configurable minutes (per shift).
 * Called by the Vercel cron route; safe to call multiple times (idempotent via updateMany WHERE status=EXPECTED).
 *
 * Also ensures EXPECTED slots exist for the date before marking.
 */

import { Shift } from '@prisma/client'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { CLASS_START_TIMES, SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger } from '@/lib/logger'
import { getAttendanceConfig, getSchoolClosure } from '@/lib/db/queries/teacher-attendance'
import { generateExpectedSlots } from './attendance-record-service'

const logger = createServiceLogger('auto-mark')

export interface AutoMarkResult {
  shift: Shift
  date: string
  marked: number
  skippedReason?: 'window_not_passed' | 'no_expected_records' | 'school_closed'
}

export async function autoMarkLateForShift(
  date: string,
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<AutoMarkResult> {
  const config = await getAttendanceConfig(client)
  const offsetMinutes =
    shift === 'MORNING'
      ? config.morningAutoMarkMinutes
      : config.afternoonAutoMarkMinutes

  // Compute the auto-mark threshold in UTC
  const { hour, minute } = CLASS_START_TIMES[shift]
  const classStartLocal = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  const classStartUtc = fromZonedTime(classStartLocal, SCHOOL_TIMEZONE)
  const thresholdUtc = new Date(classStartUtc.getTime() + offsetMinutes * 60_000)

  const now = new Date()
  if (now < thresholdUtc) {
    logger.debug(
      { shift, date, thresholdUtc, now },
      'Auto-mark window not yet passed — skipping'
    )
    return { shift, date, marked: 0, skippedReason: 'window_not_passed' }
  }

  // Guard: skip if the school is closed on this date.
  // markDateClosed only flips existing EXPECTED rows; if the cron runs first, it would
  // generate EXPECTED slots and incorrectly mark them LATE on a closed day.
  const dateObj = new Date(date)
  const closure = await client.schoolClosure.findUnique({ where: { date: dateObj } })
  if (closure) {
    logger.debug({ shift, date, reason: closure.reason }, 'School closed — skipping auto-mark')
    return { shift, date, marked: 0, skippedReason: 'school_closed' }
  }
  const activeTeachers = await client.teacherProgram.findMany({
    where: { program: 'DUGSI_PROGRAM', isActive: true },
    select: { teacherId: true, shifts: true },
  })

  const teachersForShift = activeTeachers
    .filter((tp) => tp.shifts.includes(shift))
    .map((tp) => ({ teacherId: tp.teacherId, shifts: [shift] }))

  // Wrap slot generation + updateMany in one transaction so a concurrent self-checkin
  // can't slip in between the two writes and get immediately auto-marked LATE.
  // Use isPrismaClient so the injected client is honoured (testability + correctness).
  const doWrites = async (tx: DatabaseClient) => {
    if (teachersForShift.length > 0) {
      await generateExpectedSlots(teachersForShift, dateObj, tx)
    }

    const result = await tx.teacherAttendanceRecord.updateMany({
      where: { date: dateObj, shift, status: 'EXPECTED' },
      data: { status: 'LATE', source: 'AUTO_MARKED' },
    })

    return result.count
  }

  const marked = isPrismaClient(client)
    ? await client.$transaction(doWrites)
    : await doWrites(client)

  if (marked === 0) {
    return { shift, date, marked: 0, skippedReason: 'no_expected_records' }
  }

  logger.info(
    { event: 'AUTO_MARK_LATE', shift, date, marked, thresholdUtc },
    `Auto-marked ${marked} EXPECTED records as LATE`
  )

  return { shift, date, marked }
}

/**
 * Convenience: run both shifts for a given date. Used by the cron route.
 */
export async function autoMarkBothShifts(
  date: string,
  client: DatabaseClient = prisma
): Promise<{ morning: AutoMarkResult; afternoon: AutoMarkResult }> {
  const [morning, afternoon] = await Promise.all([
    autoMarkLateForShift(date, 'MORNING', client),
    autoMarkLateForShift(date, 'AFTERNOON', client),
  ])
  return { morning, afternoon }
}
