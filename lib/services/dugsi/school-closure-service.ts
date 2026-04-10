/**
 * School Closure Service
 *
 * Manages school closure dates and propagates status changes to attendance records.
 * - markDateClosed: creates SchoolClosure + flips EXPECTED → CLOSED
 * - removeClosure: deletes SchoolClosure + reverts CLOSED → EXPECTED
 * Both operations are atomic via $transaction.
 */

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import { getSchoolClosure } from '@/lib/db/queries/teacher-attendance'
import { bulkTransitionStatus } from './attendance-record-service'

const logger = createServiceLogger('school-closure')

export async function markDateClosed(
  params: { date: Date; reason: string; createdBy?: string },
  client: DatabaseClient = prisma
): Promise<{ closure: { id: string; date: Date; reason: string }; closedCount: number }> {
  const { date, reason, createdBy } = params

  const doWrites = async (tx: DatabaseClient) => {
    const existing = await getSchoolClosure(date, tx)
    if (existing) {
      throw new Error(`School is already marked closed on ${date.toISOString().split('T')[0]}`)
    }

    const closure = await tx.schoolClosure.create({
      data: { date, reason, createdBy: createdBy ?? null },
    })

    // Propagate: only flip EXPECTED records — PRESENT/LATE teachers who showed up are unaffected
    const closedCount = await bulkTransitionStatus(
      { where: { date, status: 'EXPECTED' }, toStatus: 'CLOSED', source: 'SYSTEM' },
      tx
    )

    logger.info(
      { event: 'SCHOOL_CLOSED', date, reason, closedCount, createdBy },
      `Marked school closed (${closedCount} EXPECTED records → CLOSED)`
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
      throw new Error(`No school closure found for ${date.toISOString().split('T')[0]}`)
    }

    await tx.schoolClosure.delete({ where: { date } })

    // Revert: only CLOSED records go back to EXPECTED
    const reopenedCount = await bulkTransitionStatus(
      { where: { date, status: 'CLOSED' }, toStatus: 'EXPECTED', source: 'SYSTEM' },
      tx
    )

    logger.info(
      { event: 'SCHOOL_REOPENED', date, reopenedCount },
      `Removed school closure (${reopenedCount} CLOSED records → EXPECTED)`
    )

    return { reopenedCount }
  }

  return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
}
