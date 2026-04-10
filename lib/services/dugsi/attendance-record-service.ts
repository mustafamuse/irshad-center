/**
 * Attendance Record Service
 *
 * Business logic for TeacherAttendanceRecord lifecycle.
 * - generateExpectedSlots: idempotent EXPECTED row creation
 * - transitionStatus: validated status change
 * - adminCheckIn: write both fact-log + attendance record atomically
 */

import { Shift, TeacherAttendanceStatus, AttendanceSource } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import { assertValidTransition } from '@/lib/utils/attendance-transitions'
import {
  getAttendanceRecordById,
  getAttendanceRecordStatus,
  getAttendanceRecord,
} from '@/lib/db/queries/teacher-attendance'

const logger = createServiceLogger('attendance-record')

// ============================================================================
// EXPECTED SLOT GENERATION
// ============================================================================

export interface GenerateExpectedSlotsResult {
  created: number
  skipped: number
}

/**
 * Idempotent: insert EXPECTED records for each teacher × shift on a given date.
 * Uses createMany + skipDuplicates (ON CONFLICT DO NOTHING) — single round-trip
 * regardless of teacher count. Existing rows (any status) are left untouched.
 */
export async function generateExpectedSlots(
  params: { teacherId: string; shifts: Shift[] }[],
  date: Date,
  client: DatabaseClient = prisma
): Promise<GenerateExpectedSlotsResult> {
  const slots = params.flatMap(({ teacherId, shifts }) =>
    shifts.map((shift) => ({
      teacherId,
      date,
      shift,
      status: 'EXPECTED' as const,
      source: 'SYSTEM' as const,
    }))
  )

  if (slots.length === 0) {
    logger.info({ event: 'EXPECTED_SLOTS_GENERATED', created: 0, skipped: 0, date }, 'Generated expected slots')
    return { created: 0, skipped: 0 }
  }

  const result = await client.teacherAttendanceRecord.createMany({
    data: slots,
    skipDuplicates: true,
  })

  const created = result.count
  const skipped = slots.length - created

  logger.info({ event: 'EXPECTED_SLOTS_GENERATED', created, skipped, date }, 'Generated expected slots')
  return { created, skipped }
}

// ============================================================================
// STATUS TRANSITION
// ============================================================================

export interface TransitionParams {
  recordId: string
  toStatus: TeacherAttendanceStatus
  source: AttendanceSource
  clockInTime?: Date
  minutesLate?: number
  notes?: string
  changedBy?: string
}

export async function transitionStatus(
  params: TransitionParams,
  client: DatabaseClient = prisma
) {
  const { recordId, toStatus, source, clockInTime, minutesLate, notes, changedBy } = params

  const record = await getAttendanceRecordStatus(recordId, client)
  if (!record) {
    throw new ActionError('Attendance record not found', ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND, undefined, 404)
  }

  assertValidTransition(record.status, toStatus)

  // Optimistic lock: include current status in WHERE so a concurrent override that
  // already changed the status produces count=0 rather than silently overwriting
  // a state we never validated against.
  const result = await client.teacherAttendanceRecord.updateMany({
    where: { id: recordId, status: record.status },
    data: {
      status: toStatus,
      source,
      // Only overwrite clockInTime when explicitly supplied — omitting it leaves the
      // existing value intact (e.g. admin LATE→EXCUSED override keeps the clock-in time)
      ...(clockInTime !== undefined ? { clockInTime } : {}),
      minutesLate: toStatus === 'LATE' ? (minutesLate ?? null) : null,
      notes: notes ?? null,
      changedBy: changedBy ?? null,
    },
  })

  if (result.count === 0) {
    throw new ActionError(
      'Record was modified concurrently — please refresh and try again',
      ERROR_CODES.CONCURRENT_MODIFICATION,
      undefined,
      409
    )
  }

  logger.info(
    {
      event: 'ATTENDANCE_STATUS_TRANSITION',
      recordId,
      teacherId: record.teacherId,
      from: record.status,
      to: toStatus,
      source,
      changedBy,
    },
    `Attendance status: ${record.status} → ${toStatus}`
  )
}

// ============================================================================
// ADMIN CHECK-IN ON BEHALF
// ============================================================================

/**
 * Admin checks in a teacher who physically showed up but didn't self-check-in.
 * Creates both the DugsiTeacherCheckIn fact-log row and the attendance record atomically.
 */
export async function adminCheckIn(
  params: {
    teacherId: string
    shift: Shift
    date: Date
    changedBy: string
  },
  client: DatabaseClient = prisma
) {
  const { teacherId, shift, date, changedBy } = params
  const now = new Date()

  const doWrites = async (tx: DatabaseClient) => {
    // Check for existing check-in (pre-validate before writes per project rules)
    const existingCheckIn = await tx.dugsiTeacherCheckIn.findUnique({
      where: { teacherId_date_shift: { teacherId, date, shift } },
    })

    // Create the fact-log row (no GPS, marked as admin-initiated)
    const checkIn = existingCheckIn ?? await tx.dugsiTeacherCheckIn.create({
      data: {
        teacherId,
        date,
        shift,
        clockInTime: now,
        clockInValid: false, // admin check-in has no GPS
        isLate: false, // admin marking as present — treated as on-time
        notes: `Checked in by admin: ${changedBy}`,
      },
    })

    // Validate transition if a record already exists — prevents silently overwriting
    // statuses like EXCUSED that are not allowed to transition to PRESENT.
    const existingRecord = await tx.teacherAttendanceRecord.findUnique({
      where: { teacherId_date_shift: { teacherId, date, shift } },
      select: { status: true },
    })

    const recordData = {
      status: 'PRESENT' as const,
      source: 'ADMIN_OVERRIDE' as const,
      checkInId: checkIn.id,
      clockInTime: checkIn.clockInTime,
      minutesLate: null,
      changedBy,
    }

    if (existingRecord) {
      // Idempotent: teacher already checked in (e.g. self-checkin before admin action)
      if (existingRecord.status === 'PRESENT') {
        logger.info({ event: 'ADMIN_CHECK_IN_NOOP', teacherId, shift, date }, 'Teacher already PRESENT — skipping')
        return { checkIn }
      }
      assertValidTransition(existingRecord.status, 'PRESENT')
      // Optimistic lock: include current status in WHERE, mirroring transitionStatus.
      // Prevents a concurrent auto-mark/override from being silently overwritten.
      const updateResult = await tx.teacherAttendanceRecord.updateMany({
        where: { teacherId, date, shift, status: existingRecord.status },
        data: recordData,
      })
      if (updateResult.count === 0) {
        throw new ActionError(
          'Record was modified concurrently — please refresh and try again',
          ERROR_CODES.CONCURRENT_MODIFICATION,
          undefined,
          409
        )
      }
    } else {
      await tx.teacherAttendanceRecord.create({
        data: { teacherId, date, shift, ...recordData },
      })
    }

    logger.info(
      { event: 'ADMIN_CHECK_IN', teacherId, shift, date, changedBy },
      'Admin checked in teacher'
    )

    return { checkIn }
  }

  return isPrismaClient(client)
    ? client.$transaction(doWrites)
    : doWrites(client)
}

// ============================================================================
// BULK STATUS UPDATE (used by auto-mark and closure propagation)
// ============================================================================

export async function bulkTransitionStatus(
  params: {
    where: { date: Date; shift?: Shift; status: TeacherAttendanceStatus; source?: AttendanceSource }
    toStatus: TeacherAttendanceStatus
    source: AttendanceSource
    changedBy?: string   // recorded per-row for audit; 'cron' for auto-mark, admin name for closures
  },
  client: DatabaseClient = prisma
): Promise<number> {
  const { where, toStatus, source, changedBy } = params

  assertValidTransition(where.status, toStatus)

  const result = await client.teacherAttendanceRecord.updateMany({
    where: {
      date: where.date,
      ...(where.shift ? { shift: where.shift } : {}),
      status: where.status,
      ...(where.source ? { source: where.source } : {}),
    },
    data: {
      status: toStatus,
      source,
      // Clear minutesLate on non-LATE transitions (parity with transitionStatus).
      // Callers transitioning to LATE must set minutesLate themselves via a direct updateMany.
      minutesLate: toStatus === 'LATE' ? undefined : null,
      ...(changedBy !== undefined ? { changedBy } : {}),
    },
  })

  return result.count
}

/**
 * Reverts all CLOSED records on a date back to EXPECTED.
 * This is the only legitimate CLOSED → EXPECTED path — the caller (removeClosure)
 * atomically deletes the SchoolClosure row in the same transaction.
 * Kept as a named function rather than a `skipValidation` escape hatch so that
 * this intent is self-documenting and impossible to misuse from other call sites.
 */
export async function bulkReopenDate(
  params: { date: Date; source: AttendanceSource },
  client: DatabaseClient = prisma
): Promise<number> {
  const result = await client.teacherAttendanceRecord.updateMany({
    where: { date: params.date, status: 'CLOSED' },
    data: { status: 'EXPECTED', source: params.source },
  })
  return result.count
}
