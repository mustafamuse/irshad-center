/**
 * School Closure Service
 *
 * Manages school closure dates and propagates status changes to attendance records.
 * - markDateClosed: creates SchoolClosure + flips EXPECTED → CLOSED and AUTO_MARKED LATE → CLOSED
 * - removeClosure: deletes SchoolClosure + reverts CLOSED → EXPECTED
 * Both operations are atomic via $transaction.
 */

import { Prisma } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import { getSchoolClosure } from '@/lib/db/queries/teacher-attendance'
import { bulkTransitionStatus, bulkReopenDate } from './attendance-record-service'

const logger = createServiceLogger('school-closure')

export async function markDateClosed(
  params: { date: Date; reason: string; createdBy?: string },
  client: DatabaseClient = prisma
): Promise<{ closure: { id: string; date: Date; reason: string }; closedCount: number }> {
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

    // Propagate: flip EXPECTED → CLOSED for all slots that haven't been acted on yet.
    const closedCount = await bulkTransitionStatus(
      { where: { date, status: 'EXPECTED' }, toStatus: 'CLOSED', source: 'SYSTEM', changedBy: createdBy },
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
    const autoMarkResult = await tx.teacherAttendanceRecord.updateMany({
      where: { date, status: 'LATE', source: 'AUTO_MARKED' },
      data: { status: 'CLOSED', source: 'SYSTEM', changedBy: createdBy ?? null },
    })
    const autoMarkedCount = autoMarkResult.count

    logger.info(
      { event: 'SCHOOL_CLOSED', date, reason, closedCount, autoMarkedCount, createdBy },
      `Marked school closed (${closedCount} EXPECTED + ${autoMarkedCount} AUTO_MARKED → CLOSED)`
    )

    return { closure, closedCount: closedCount + autoMarkedCount }
  }

  // Catch P2002 outside the transaction: two admins both passing the getSchoolClosure
  // guard (READ COMMITTED) race to create — the loser's tx is aborted by PostgreSQL.
  // The P2002 bubbles out of $transaction and is remapped here to a clean 409.
  let result: Awaited<ReturnType<typeof doWrites>>
  try {
    result = isPrismaClient(client) ? await client.$transaction(doWrites) : await doWrites(client)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
    // Uses bulkReopenDate — the only code path that may transition CLOSED → EXPECTED,
    // since the SchoolClosure row is deleted atomically above in the same transaction.
    const reopenedCount = await bulkReopenDate({ date, source: 'SYSTEM', changedBy }, tx)

    logger.info(
      { event: 'SCHOOL_REOPENED', date, reopenedCount },
      `Removed school closure (${reopenedCount} CLOSED records → EXPECTED)`
    )

    return { reopenedCount }
  }

  // Catch P2025 outside the transaction: two admins both passing the getSchoolClosure
  // guard (READ COMMITTED) race to delete the same closure row — the loser gets P2025
  // ("Record to delete does not exist"). Catching inside $transaction would run additional
  // queries on an already-aborted PostgreSQL transaction. Same pattern as P2002 in markDateClosed.
  let result: Awaited<ReturnType<typeof doWrites>>
  try {
    result = isPrismaClient(client) ? await client.$transaction(doWrites) : await doWrites(client)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
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
