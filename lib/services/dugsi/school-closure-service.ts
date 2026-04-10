/**
 * School Closure Service
 *
 * Manages school closure dates and propagates status changes to attendance records.
 * - markDateClosed: creates SchoolClosure + flips EXPECTED → CLOSED and AUTO_MARKED LATE → CLOSED
 * - removeClosure: deletes SchoolClosure + reverts CLOSED → EXPECTED
 * Both operations are atomic via $transaction.
 */

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

    // Propagate: flip EXPECTED → CLOSED for all no-shows.
    // Also flip AUTO_MARKED LATE → CLOSED: the 21:00 UTC cron may have fired before
    // the admin called markDateClosed, leaving records as LATE even though school was
    // closed. Self-checkin LATE teachers who physically showed up are left as-is.
    const closedCount = await bulkTransitionStatus(
      { where: { date, status: 'EXPECTED' }, toStatus: 'CLOSED', source: 'SYSTEM' },
      tx
    )
    const autoMarkedCount = await bulkTransitionStatus(
      { where: { date, status: 'LATE', source: 'AUTO_MARKED' }, toStatus: 'CLOSED', source: 'SYSTEM' },
      tx
    )

    logger.info(
      { event: 'SCHOOL_CLOSED', date, reason, closedCount, autoMarkedCount, createdBy },
      `Marked school closed (${closedCount} EXPECTED + ${autoMarkedCount} AUTO_MARKED → CLOSED)`
    )

    return { closure, closedCount }
  }

  return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
}

export async function removeClosure(
  params: { date: Date },
  client: DatabaseClient = prisma
): Promise<{ reopenedCount: number }> {
  const { date } = params

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

    // Revert: only CLOSED records go back to EXPECTED.
    // Uses bulkReopenDate — the only code path that may transition CLOSED → EXPECTED,
    // since the SchoolClosure row is deleted atomically above in the same transaction.
    const reopenedCount = await bulkReopenDate({ date, source: 'SYSTEM' }, tx)

    logger.info(
      { event: 'SCHOOL_REOPENED', date, reopenedCount },
      `Removed school closure (${reopenedCount} CLOSED records → EXPECTED)`
    )

    return { reopenedCount }
  }

  return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
}
