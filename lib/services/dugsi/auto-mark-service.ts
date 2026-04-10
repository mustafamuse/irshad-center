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
import { getAttendanceConfig, getActiveDugsiTeacherShifts } from '@/lib/db/queries/teacher-attendance'
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

  const dateObj = new Date(date)

  // Wrap slot generation + updateMany in one transaction so:
  // - A concurrent self-checkin can't slip between the slot write and the auto-mark.
  // - A concurrent markDateClosed can't create a closure between the guard and the updateMany.
  // Use isPrismaClient so the injected client is honoured (testability + correctness).
  type DoWritesResult = { kind: 'closed' } | { kind: 'marked'; count: number }

  const doWrites = async (tx: DatabaseClient): Promise<DoWritesResult> => {
    // Guard inside the transaction: a concurrent markDateClosed could create a closure
    // between an outer check and this updateMany, so we re-check here at commit time.
    const closure = await tx.schoolClosure.findUnique({ where: { date: dateObj } })
    if (closure) {
      return { kind: 'closed' }
    }

    // Read active teachers inside the transaction so the slot generation is atomic
    // with the auto-mark write: a teacher deactivated between the outer read and the
    // updateMany could otherwise get a spurious LATE slot created inside the tx.
    const activeTeachers = await getActiveDugsiTeacherShifts(tx)
    const teachersForShift = activeTeachers
      .filter((tp) => tp.shifts.includes(shift))
      .map((tp) => ({ teacherId: tp.teacherId, shifts: [shift] as Shift[] }))

    if (teachersForShift.length > 0) {
      await generateExpectedSlots(teachersForShift, dateObj, tx)
    }

    // Use offsetMinutes (the configured threshold) rather than `now - classStart` —
    // the cron fires at 21:00 UTC, so `now - classStart` would produce ~360 min for
    // morning and ~90 min for afternoon, making the displayed value misleading.
    // The configured offset is the most honest value: it's exactly how late
    // the auto-mark window was set when the records were created.
    const minutesLate = offsetMinutes

    const result = await tx.teacherAttendanceRecord.updateMany({
      where: { date: dateObj, shift, status: 'EXPECTED' },
      data: { status: 'LATE', source: 'AUTO_MARKED', minutesLate },
    })

    return { kind: 'marked', count: result.count }
  }

  const writeResult = isPrismaClient(client)
    ? await client.$transaction(doWrites)
    : await doWrites(client)

  if (writeResult.kind === 'closed') {
    logger.debug({ shift, date }, 'School closed — skipping auto-mark (checked in-tx)')
    return { shift, date, marked: 0, skippedReason: 'school_closed' }
  }

  const marked = writeResult.count

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
  // Sequential (not parallel): if an admin creates a closure between the two
  // transactions, parallel execution would produce an inconsistent state where
  // MORNING records are LATE but AFTERNOON records are correctly CLOSED.
  const morning = await autoMarkLateForShift(date, 'MORNING', client)
  const afternoon = await autoMarkLateForShift(date, 'AFTERNOON', client)
  return { morning, afternoon }
}
