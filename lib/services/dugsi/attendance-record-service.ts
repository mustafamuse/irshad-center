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
import { createServiceLogger } from '@/lib/logger'
import { assertValidTransition } from '@/lib/utils/attendance-transitions'
import {
  getAttendanceRecordById,
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
 * Idempotent: upsert EXPECTED records for each teacher × shift on a given date.
 * Only creates if status is EXPECTED (won't overwrite a PRESENT/LATE/etc record).
 */
export async function generateExpectedSlots(
  params: { teacherId: string; shifts: Shift[] }[],
  date: Date,
  client: DatabaseClient = prisma
): Promise<GenerateExpectedSlotsResult> {
  let created = 0
  let skipped = 0

  for (const { teacherId, shifts } of params) {
    for (const shift of shifts) {
      const existing = await client.teacherAttendanceRecord.findUnique({
        where: { teacherId_date_shift: { teacherId, date, shift } },
        select: { status: true },
      })

      if (existing) {
        skipped++
        continue
      }

      await client.teacherAttendanceRecord.create({
        data: { teacherId, date, shift, status: 'EXPECTED', source: 'SYSTEM' },
      })
      created++
    }
  }

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

  const record = await getAttendanceRecordById(recordId, client)
  if (!record) {
    throw new Error(`Attendance record not found: ${recordId}`)
  }

  assertValidTransition(record.status, toStatus)

  const updated = await client.teacherAttendanceRecord.update({
    where: { id: recordId },
    data: {
      status: toStatus,
      source,
      clockInTime: clockInTime ?? null,
      minutesLate: toStatus === 'LATE' ? (minutesLate ?? null) : null,
      notes: notes ?? null,
      changedBy: changedBy ?? null,
    },
  })

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

  return updated
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

    // Upsert the attendance record
    const record = await tx.teacherAttendanceRecord.upsert({
      where: { teacherId_date_shift: { teacherId, date, shift } },
      create: {
        teacherId,
        date,
        shift,
        status: 'PRESENT',
        source: 'ADMIN_OVERRIDE',
        checkInId: checkIn.id,
        clockInTime: checkIn.clockInTime,
        minutesLate: null,
        changedBy,
      },
      update: {
        status: 'PRESENT',
        source: 'ADMIN_OVERRIDE',
        checkInId: checkIn.id,
        clockInTime: checkIn.clockInTime,
        minutesLate: null,
        changedBy,
      },
    })

    logger.info(
      { event: 'ADMIN_CHECK_IN', teacherId, shift, date, changedBy },
      'Admin checked in teacher'
    )

    return { record, checkIn }
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
    where: { date: Date; shift?: Shift; status: TeacherAttendanceStatus }
    toStatus: TeacherAttendanceStatus
    source: AttendanceSource
  },
  client: DatabaseClient = prisma
): Promise<number> {
  const { where, toStatus, source } = params

  const result = await client.teacherAttendanceRecord.updateMany({
    where: {
      date: where.date,
      ...(where.shift ? { shift: where.shift } : {}),
      status: where.status,
    },
    data: { status: toStatus, source },
  })

  return result.count
}
