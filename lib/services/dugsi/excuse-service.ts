/**
 * Excuse Service
 *
 * Handles teacher excuse request submissions and admin review.
 * Eligibility: only LATE or ABSENT records can be excused.
 * Constraint: a record can only have one PENDING or APPROVED request at a time.
 */

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import {
  getAttendanceRecordById,
  getExcuseRequestById,
  getExistingActiveExcuse,
} from '@/lib/db/queries/teacher-attendance'

const logger = createServiceLogger('excuse')

export async function submitExcuse(
  params: { attendanceRecordId: string; teacherId: string; reason: string },
  client: DatabaseClient = prisma
) {
  const { attendanceRecordId, teacherId, reason } = params

  const record = await getAttendanceRecordById(attendanceRecordId, client)
  if (!record) {
    throw new Error(`Attendance record not found: ${attendanceRecordId}`)
  }

  if (record.teacherId !== teacherId) {
    throw new Error('You can only submit excuses for your own attendance records')
  }

  if (record.status !== 'LATE' && record.status !== 'ABSENT') {
    throw new Error(
      `Cannot submit excuse for a record with status ${record.status}. Only LATE or ABSENT records are eligible.`
    )
  }

  const existing = await getExistingActiveExcuse(attendanceRecordId, client)
  if (existing) {
    throw new Error(
      'An excuse request is already pending or approved for this record'
    )
  }

  const excuseRequest = await client.excuseRequest.create({
    data: { attendanceRecordId, teacherId, reason, status: 'PENDING' },
  })

  logger.info(
    { event: 'EXCUSE_SUBMITTED', excuseRequestId: excuseRequest.id, teacherId, attendanceRecordId },
    'Teacher submitted excuse request'
  )

  return excuseRequest
}

export async function approveExcuse(
  params: { excuseRequestId: string; adminNote?: string; reviewedBy: string },
  client: DatabaseClient = prisma
) {
  const { excuseRequestId, adminNote, reviewedBy } = params

  const doWrites = async (tx: DatabaseClient) => {
    const excuseRequest = await getExcuseRequestById(excuseRequestId, tx)
    if (!excuseRequest) throw new Error(`Excuse request not found: ${excuseRequestId}`)
    if (excuseRequest.status !== 'PENDING') {
      throw new Error(`Excuse request is already ${excuseRequest.status}`)
    }

    const [updated] = await Promise.all([
      tx.excuseRequest.update({
        where: { id: excuseRequestId },
        data: { status: 'APPROVED', adminNote: adminNote ?? null, reviewedBy, reviewedAt: new Date() },
      }),
      tx.teacherAttendanceRecord.update({
        where: { id: excuseRequest.attendanceRecordId },
        data: { status: 'EXCUSED', source: 'ADMIN_OVERRIDE', changedBy: reviewedBy },
      }),
    ])

    logger.info(
      { event: 'EXCUSE_APPROVED', excuseRequestId, reviewedBy },
      'Admin approved excuse request'
    )

    return updated
  }

  return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
}

export async function rejectExcuse(
  params: { excuseRequestId: string; adminNote?: string; reviewedBy: string },
  client: DatabaseClient = prisma
) {
  const { excuseRequestId, adminNote, reviewedBy } = params

  const excuseRequest = await getExcuseRequestById(excuseRequestId, client)
  if (!excuseRequest) throw new Error(`Excuse request not found: ${excuseRequestId}`)
  if (excuseRequest.status !== 'PENDING') {
    throw new Error(`Excuse request is already ${excuseRequest.status}`)
  }

  const updated = await client.excuseRequest.update({
    where: { id: excuseRequestId },
    data: { status: 'REJECTED', adminNote: adminNote ?? null, reviewedBy, reviewedAt: new Date() },
  })

  logger.info(
    { event: 'EXCUSE_REJECTED', excuseRequestId, reviewedBy },
    'Admin rejected excuse request'
  )

  return updated
}
