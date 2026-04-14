/**
 * School Closure Service
 *
 * Manages school closure dates and propagates status changes to attendance records.
 * - markDateClosed: creates SchoolClosure + flips EXPECTED → CLOSED and AUTO_MARKED LATE → CLOSED; rejects active excuse requests on AUTO_MARKED LATE records
 * - removeClosure: deletes SchoolClosure + reverts CLOSED → EXPECTED
 * Both operations are atomic via $transaction.
 */

import { Prisma, TeacherAttendanceStatus } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { prisma } from '@/lib/db'
import {
  getActiveDugsiTeacherShifts,
  getSchoolClosure,
} from '@/lib/db/queries/teacher-attendance'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'

import {
  bulkTransitionStatus,
  generateExpectedSlots,
} from './attendance-record-service'

const logger = createServiceLogger('school-closure')

export async function markDateClosed(
  params: { date: Date; reason: string; createdBy?: string },
  client: DatabaseClient = prisma
): Promise<{
  closure: { id: string; date: Date; reason: string }
  closedCount: number
}> {
  const { date, reason, createdBy } = params

  const doWrites = async (tx: DatabaseClient) => {
    const existing = await getSchoolClosure(date, tx)
    if (existing) {
      throw new ActionError(
        `School is already marked closed on ${formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')}`,
        ERROR_CODES.CLOSURE_EXISTS,
        undefined,
        409
      )
    }

    const closure = await tx.schoolClosure.create({
      data: { date, reason, createdBy: createdBy ?? null },
    })

    // Seed EXPECTED rows for all active teachers before flipping them.
    // generateExpectedSlots is idempotent (createMany + skipDuplicates) so existing
    // rows are left untouched. Without this, closing a future date that auto-mark
    // hasn't run yet produces zero rows in the grid — teachers never appear as CLOSED.
    const teachers = await getActiveDugsiTeacherShifts(tx)
    await generateExpectedSlots(teachers, date, tx)

    // Propagate: flip EXPECTED → CLOSED, saving previousStatus so reopenClosedRecords
    // can restore the original state instead of always reverting to EXPECTED.
    const closedCount = await bulkTransitionStatus(
      {
        where: { date, status: 'EXPECTED' },
        toStatus: 'CLOSED',
        source: 'SYSTEM',
        action: 'closure_mark',
        changedBy: createdBy,
        previousStatus: 'EXPECTED',
      },
      tx
    )
    // Cancel active excuses on AUTO_MARKED LATE records before flipping them to CLOSED.
    // Must run BEFORE the attendance updateMany below so the attendanceRecord.status filter
    // still matches LATE. Without this, CLOSED → EXCUSED (invalid transition) would leave
    // the excuse permanently un-actionable in the admin queue.
    // Filter is intentionally narrow (source: AUTO_MARKED) — SELF_CHECKIN LATE records
    // are NOT flipped to CLOSED below, so their excuses remain actionable (LATE → EXCUSED
    // is still valid). Only AUTO_MARKED records become CLOSED and need excuse cleanup.
    await tx.excuseRequest.updateMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        attendanceRecord: { date, status: 'LATE', source: 'AUTO_MARKED' },
      },
      data: {
        status: 'REJECTED',
        adminNote: 'Auto-rejected: school marked closed',
        reviewedBy: createdBy ?? 'system',
        reviewedAt: new Date(),
      },
    })

    // INTENTIONAL bypass: AUTO_MARKED LATE → CLOSED is not in ALLOWED_TRANSITIONS
    // because the override dialog must never close a teacher who physically showed up
    // (SELF_CHECKIN LATE). This is the only code path that performs this transition;
    // callers must use markDateClosed() rather than transitionStatus() for this case.
    // previousStatus: 'LATE' so reopenClosedRecords can restore LATE correctly.
    const { count: autoMarkedCount } =
      await tx.teacherAttendanceRecord.updateMany({
        where: { date, status: 'LATE', source: 'AUTO_MARKED' },
        data: {
          status: 'CLOSED',
          previousStatus: 'LATE',
          source: 'SYSTEM',
          changedBy: createdBy ?? null,
        },
      })

    logger.info(
      {
        event: 'SCHOOL_CLOSED',
        date,
        reason,
        closedCount,
        autoMarkedCount,
        createdBy,
      },
      `Marked school closed (${closedCount} EXPECTED + ${autoMarkedCount} AUTO_MARKED → CLOSED)`
    )

    return { closure, closedCount: closedCount + autoMarkedCount }
  }

  // Catch P2002 outside the transaction: two admins both passing the getSchoolClosure
  // guard (READ COMMITTED) race to create — the loser's tx is aborted by PostgreSQL.
  // The P2002 bubbles out of $transaction and is remapped here to a clean 409.
  let result: Awaited<ReturnType<typeof doWrites>>
  try {
    result = isPrismaClient(client)
      ? await client.$transaction(doWrites)
      : await doWrites(client)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ActionError(
        `School is already marked closed on ${formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')}`,
        ERROR_CODES.CLOSURE_EXISTS,
        undefined,
        409
      )
    }
    throw error
  }
  return result
}

// Private — only called by removeClosure below, inside the same $transaction.
// Keeping this here (rather than in attendance-record-service) makes the coupling
// compiler-enforced: nothing outside this file can accidentally skip the SchoolClosure
// row deletion that must accompany the status revert.
//
// Restores pre-closure status using the `previousStatus` column populated by
// markDateClosed. Records without a previousStatus (legacy rows or edge cases) fall
// back to EXPECTED. One updateMany per distinct previousStatus value keeps this
// efficient without per-row updates.
async function reopenClosedRecords(
  params: { date: Date; changedBy?: string },
  tx: DatabaseClient
): Promise<number> {
  const { date, changedBy } = params
  const changedByData = changedBy !== undefined ? { changedBy } : {}

  // Fetch all CLOSED records grouped by their previousStatus value.
  const closedRecords = await tx.teacherAttendanceRecord.findMany({
    where: { date, status: 'CLOSED' },
    select: { id: true, previousStatus: true },
  })

  if (closedRecords.length === 0) return 0

  // Group record IDs by the status they should be restored to.
  const groups = new Map<TeacherAttendanceStatus | null, string[]>()
  for (const record of closedRecords) {
    const key = record.previousStatus
    const ids = groups.get(key) ?? []
    ids.push(record.id)
    groups.set(key, ids)
  }

  let totalCount = 0

  for (const [restoreStatus, ids] of groups) {
    const targetStatus: TeacherAttendanceStatus = restoreStatus ?? 'EXPECTED'
    const { count } = await tx.teacherAttendanceRecord.updateMany({
      where: { id: { in: ids } },
      data: {
        status: targetStatus,
        previousStatus: null,
        source: 'SYSTEM',
        ...changedByData,
      },
    })
    totalCount += count
  }

  return totalCount
}

export async function removeClosure(
  params: { date: Date; changedBy?: string },
  client: DatabaseClient = prisma
): Promise<{ reopenedCount: number }> {
  const { date, changedBy } = params

  const doWrites = async (tx: DatabaseClient) => {
    const existing = await getSchoolClosure(date, tx)
    if (!existing) {
      throw new ActionError(
        `No school closure found for ${formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')}`,
        ERROR_CODES.NOT_FOUND,
        undefined,
        404
      )
    }

    await tx.schoolClosure.delete({ where: { date } })

    // Cancel active excuses on CLOSED records before reverting them to EXPECTED.
    // Possible if a teacher had an AUTO_MARKED LATE excuse pending when the date was
    // closed: the record flipped CLOSED but the ExcuseRequest remained PENDING.
    // Clearing it here prevents a ghost entry in the queue after reopening.
    await tx.excuseRequest.updateMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        attendanceRecord: { date, status: 'CLOSED' },
      },
      data: {
        status: 'REJECTED',
        adminNote: 'Auto-rejected: school closure removed',
        reviewedBy: changedBy ?? 'system',
        reviewedAt: new Date(),
      },
    })

    // Revert: only CLOSED records go back to EXPECTED.
    // Uses the module-private reopenClosedRecords — the only code path that may transition
    // CLOSED → EXPECTED, since the SchoolClosure row is deleted atomically above.
    const reopenedCount = await reopenClosedRecords({ date, changedBy }, tx)

    logger.info(
      { event: 'SCHOOL_REOPENED', date, reopenedCount },
      `Removed school closure (${reopenedCount} CLOSED records → EXPECTED)`
    )

    if (reopenedCount > 0) {
      logger.warn(
        { event: 'CLOSURE_REOPEN_MANUAL_REVIEW_NEEDED', date, reopenedCount },
        `Closure removed: ${reopenedCount} records reverted to EXPECTED. ` +
          'Teachers previously auto-marked LATE will not be re-marked automatically — ' +
          'an admin should review and manually correct affected records in the attendance grid.'
      )
      // Future improvement: surface a persistent banner on the attendance page
      // (e.g. "N records reverted to EXPECTED — review manually") so admins who
      // navigate away from the closures page after removal are still notified.
      // Requires storing the flag in the DB (e.g. a DugsiAttendanceAlert table)
      // or a query-param hand-off between the closures and attendance pages.
    }

    return { reopenedCount }
  }

  // Catch P2025 outside the transaction: two admins both passing the getSchoolClosure
  // guard (READ COMMITTED) race to delete the same closure row — the loser gets P2025
  // ("Record to delete does not exist"). Catching inside $transaction would run additional
  // queries on an already-aborted PostgreSQL transaction. Same pattern as P2002 in markDateClosed.
  let result: Awaited<ReturnType<typeof doWrites>>
  try {
    result = isPrismaClient(client)
      ? await client.$transaction(doWrites)
      : await doWrites(client)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new ActionError(
        `No school closure found for ${formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')}`,
        ERROR_CODES.NOT_FOUND,
        undefined,
        404
      )
    }
    throw error
  }
  return result
}
