/**
 * Auto-mark Service
 *
 * Marks EXPECTED attendance records as LATE when the auto-mark window has passed.
 * Window = class start time + N configurable minutes (per shift).
 * Called by the Vercel cron route; safe to call multiple times (idempotent via updateMany WHERE status=EXPECTED).
 *
 * Also ensures EXPECTED slots exist for the date before marking.
 */

import { DugsiAttendanceConfig, Shift } from '@prisma/client'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { CLASS_START_TIMES, SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger } from '@/lib/logger'
import { getAttendanceConfig, getActiveDugsiTeacherShifts, TeacherShift } from '@/lib/db/queries/teacher-attendance'
import { assertValidTransition } from '@/lib/utils/attendance-transitions'
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
  // Config is required: callers must fetch it via getAttendanceConfig (a PrismaClient-only
  // call) before entering any transaction. autoMarkBothShifts fetches once and forwards it
  // to both shifts; direct callers must do the same. This eliminates the PrismaClient cast
  // and the runtime guard that was needed when config was optional.
  config: DugsiAttendanceConfig,
  client: DatabaseClient = prisma,
  // Optional pre-fetched teacher roster — when omitted, fetched inside doWrites.
  prefetchedTeachers?: TeacherShift[]
): Promise<AutoMarkResult> {
  // Fast-fail if the transition table ever removes EXPECTED → LATE.
  // The updateMany inside doWrites bypasses assertValidTransition directly;
  // this guard ensures the cron breaks loudly rather than silently doing nothing.
  assertValidTransition('EXPECTED', 'LATE')

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

  const dateObj = new Date(`${date}T00:00:00Z`)

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
    // autoMarkBothShifts pre-fetches once inside the shared tx and passes it here to
    // avoid a duplicate query per shift; direct callers omit it and fetch here.
    const activeTeachers = prefetchedTeachers ?? await getActiveDugsiTeacherShifts(tx)
    const teachersForShift = activeTeachers
      .filter((tp) => tp.shifts.includes(shift))
      .map((tp) => ({ teacherId: tp.teacherId, shifts: [shift] as Shift[] }))

    if (teachersForShift.length > 0) {
      await generateExpectedSlots(teachersForShift, dateObj, tx)
    }

    const result = await tx.teacherAttendanceRecord.updateMany({
      where: { date: dateObj, shift, status: 'EXPECTED' },
      // minutesLate is intentionally null for AUTO_MARKED records. The cron fires at
      // 21:00 UTC, so `now - classStart` would produce a misleading offset (~360 min
      // morning, ~90 min afternoon). The configured threshold reflects *when* the window
      // was set, not actual lateness. AttendanceStatusBadge renders "Late (auto)" for
      // source=AUTO_MARKED records to distinguish this case.
      // CONTRACT: callers reading minutesLate on LATE records must check
      // source !== 'AUTO_MARKED' before treating null as "lateness unknown" —
      // for AUTO_MARKED the teacher simply never arrived.
      data: { status: 'LATE', source: 'AUTO_MARKED', minutesLate: null, changedBy: 'cron' },
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
 *
 * Each shift runs in its own independent $transaction. This prevents a failure in
 * AFTERNOON from rolling back MORNING marks and producing a misleading `marked=0`
 * in the log. The two shifts write to disjoint rows (different `shift` value),
 * so there is no shared state to protect with a common transaction. Each shift
 * fetches its own teacher roster inside its own transaction; a teacher deactivated
 * between the two calls is a one-run edge case that self-corrects on the next run.
 */
export async function autoMarkBothShifts(
  date: string,
  client: DatabaseClient = prisma
): Promise<{ morning: AutoMarkResult | null; afternoon: AutoMarkResult | null }> {
  if (!isPrismaClient(client)) {
    throw new Error(
      'autoMarkBothShifts: must be called with the root prisma client, not a transaction — ' +
      'getAttendanceConfig cannot run inside a $transaction'
    )
  }

  // Fetch config once — acceptable one-invocation staleness (same rationale as before).
  const config = await getAttendanceConfig(client)

  // Promise.allSettled — not Promise.all — so a failure in one shift doesn't discard
  // the other's committed result. Each shift runs in its own independent $transaction;
  // they write to disjoint rows (different `shift` value), so there is no shared state.
  // prefetchedTeachers is deliberately NOT forwarded — each shift fetches its own roster
  // inside its transaction, preserving the atomicity guarantee.
  const [morningSettled, afternoonSettled] = await Promise.allSettled([
    autoMarkLateForShift(date, 'MORNING', config, client),
    autoMarkLateForShift(date, 'AFTERNOON', config, client),
  ])

  const morning = morningSettled.status === 'fulfilled' ? morningSettled.value : null
  const afternoon = afternoonSettled.status === 'fulfilled' ? afternoonSettled.value : null

  if (morningSettled.status === 'rejected') {
    logger.error(
      { event: 'MORNING_SHIFT_FAILED', date, err: morningSettled.reason },
      'Morning shift auto-mark failed'
    )
  }
  if (afternoonSettled.status === 'rejected') {
    logger.error(
      { event: 'AFTERNOON_SHIFT_FAILED', date, err: afternoonSettled.reason },
      'Afternoon shift auto-mark failed'
    )
  }

  // Both shifts failed — surface as a single rejection so the cron route returns 500.
  if (!morning && !afternoon) {
    throw new Error('Both MORNING and AFTERNOON auto-mark shifts failed — see per-shift error logs above')
  }

  return { morning, afternoon }
}
