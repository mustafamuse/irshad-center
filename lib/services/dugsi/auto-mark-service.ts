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
import { DatabaseClient } from '@/lib/db/types'
import { CLASS_START_TIMES, SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger } from '@/lib/logger'
import { getAttendanceConfig } from '@/lib/db/queries/teacher-attendance'
import { generateExpectedSlots } from './attendance-record-service'

const logger = createServiceLogger('auto-mark')

export interface AutoMarkResult {
  shift: Shift
  date: string
  marked: number
  skippedReason?: 'window_not_passed' | 'no_expected_records'
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

  // Ensure EXPECTED slots exist before trying to mark them
  const dateObj = new Date(date)
  const activeTeachers = await client.teacherProgram.findMany({
    where: { program: 'DUGSI_PROGRAM', isActive: true },
    select: { teacherId: true, shifts: true },
  })

  const teachersForShift = activeTeachers
    .filter((tp) => tp.shifts.includes(shift))
    .map((tp) => ({ teacherId: tp.teacherId, shifts: [shift] }))

  if (teachersForShift.length > 0) {
    await generateExpectedSlots(teachersForShift, dateObj, client)
  }

  // Mark all still-EXPECTED records for this date+shift as LATE
  const result = await client.teacherAttendanceRecord.updateMany({
    where: { date: dateObj, shift, status: 'EXPECTED' },
    data: { status: 'LATE', source: 'AUTO_MARKED' },
  })

  if (result.count === 0) {
    return { shift, date, marked: 0, skippedReason: 'no_expected_records' }
  }

  logger.info(
    { event: 'AUTO_MARK_LATE', shift, date, marked: result.count, thresholdUtc },
    `Auto-marked ${result.count} EXPECTED records as LATE`
  )

  return { shift, date, marked: result.count }
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
