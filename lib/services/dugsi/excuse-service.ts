/**
 * Excuse Service
 *
 * Handles teacher excuse request submissions and admin review.
 * Eligibility: only LATE or ABSENT records can be excused.
 * Constraint: a record can only have one PENDING or APPROVED request at a time.
 */

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import { assertValidTransition } from '@/lib/utils/attendance-transitions'
import {
  getAttendanceRecordStatus,
  getExcuseRequestById,
  getExistingActiveExcuse,
} from '@/lib/db/queries/teacher-attendance'

const logger = createServiceLogger('excuse')

export async function submitExcuse(
  params: { attendanceRecordId: string; teacherId: string; reason: string },
  client: DatabaseClient = prisma
) {
  const { attendanceRecordId, teacherId, reason } = params

  // All reads and the write happen inside a single transaction so that:
  // - The status check is atomic with the duplicate-excuse check.
  // - An admin override can't change eligibility between check and insert.
  // - Ownership is re-verified inside the transaction (service is authoritative;
  //   callers such as tests or future actions can't bypass this check).
  const doWrites = async (tx: DatabaseClient) => {
    const record = await getAttendanceRecordStatus(attendanceRecordId, tx)
    if (!record) {
      throw new ActionError('Attendance record not found', ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND)
    }

    if (record.teacherId !== teacherId) {
      throw new ActionError(
        'Attendance record does not belong to this teacher',
        ERROR_CODES.EXCUSE_NOT_ELIGIBLE,
        undefined,
        403
      )
    }

    if (record.status !== 'LATE' && record.status !== 'ABSENT') {
      throw new ActionError(
        `Cannot submit excuse for a ${record.status} record — only LATE or ABSENT records are eligible`,
        ERROR_CODES.EXCUSE_NOT_ELIGIBLE
      )
    }

    const existing = await getExistingActiveExcuse(attendanceRecordId, tx)
    if (existing) {
      throw new ActionError(
        'An excuse request is already pending or approved for this record',
        ERROR_CODES.ALREADY_EXCUSED
      )
    }

    // NOTE: ExcuseRequest.teacherId denormalizes TeacherAttendanceRecord.teacherId
    // to support fast lookups by teacher without joining through the record.
    // The ownership check above validates they match, but there is no DB-level
    // CHECK constraint — a direct insert with a mismatched teacherId would silently
    // succeed. Track a future migration to add the constraint if this becomes a concern.
    //
    // The partial unique index on (attendanceRecordId) WHERE status IN ('PENDING','APPROVED')
    // is the true concurrency guard — getExistingActiveExcuse is a fast-path guard only.
    // P2002 from the index is caught OUTSIDE the transaction (project rule: never
    // try-catch P2002 inside $transaction) and remapped to ALREADY_EXCUSED.
    return tx.excuseRequest.create({
      data: { attendanceRecordId, teacherId, reason, status: 'PENDING' },
    })
  }

  let excuseRequest
  try {
    excuseRequest = isPrismaClient(client)
      ? await client.$transaction(doWrites)
      : await doWrites(client)
  } catch (error) {
    // The partial unique index on (attendanceRecordId) WHERE status IN ('PENDING','APPROVED')
    // catches concurrent submissions that both passed the getExistingActiveExcuse guard.
    // PostgreSQL aborts the transaction on the constraint violation — catch it here, outside
    // the transaction boundary, and remap to a user-facing error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ActionError(
        'An excuse request is already pending or approved for this record',
        ERROR_CODES.ALREADY_EXCUSED
      )
    }
    throw error
  }

  logger.info(
    { event: 'EXCUSE_SUBMITTED', excuseRequestId: excuseRequest.id, resolvedTeacherId: teacherId, attendanceRecordId },
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
    if (!excuseRequest) {
      throw new ActionError('Excuse request not found', ERROR_CODES.EXCUSE_REQUEST_NOT_FOUND)
    }
    if (excuseRequest.status !== 'PENDING') {
      throw new ActionError(
        `Excuse request is already ${excuseRequest.status}`,
        ERROR_CODES.INVALID_TRANSITION
      )
    }

    // Validate transition before writing: between excuse submission and admin approval
    // the record status may have changed (e.g. admin override or removeClosure reverted
    // CLOSED → EXPECTED). Fetch current status inside the transaction and assert.
    const currentRecord = await tx.teacherAttendanceRecord.findUnique({
      where: { id: excuseRequest.attendanceRecordId },
      select: { status: true },
    })
    if (!currentRecord) {
      throw new ActionError('Attendance record not found', ERROR_CODES.ATTENDANCE_RECORD_NOT_FOUND)
    }
    assertValidTransition(currentRecord.status, 'EXCUSED')

    const updated = await tx.excuseRequest.update({
      where: { id: excuseRequestId },
      data: { status: 'APPROVED', adminNote: adminNote ?? null, reviewedBy, reviewedAt: new Date() },
    })
    // Optimistic lock: include current status in WHERE so a concurrent override
    // that already changed the record (e.g. another excuse approved first) produces
    // count=0 instead of silently overwriting the new state.
    // Sequential (not Promise.all): Prisma interactive transactions use a single
    // connection and cannot process concurrent queries on the same tx client.
    const statusResult = await tx.teacherAttendanceRecord.updateMany({
      where: { id: excuseRequest.attendanceRecordId, status: currentRecord.status },
      data: { status: 'EXCUSED', source: 'ADMIN_OVERRIDE', changedBy: reviewedBy },
    })
    if (statusResult.count === 0) {
      throw new ActionError(
        'Record was modified concurrently — please refresh and try again',
        ERROR_CODES.CONCURRENT_MODIFICATION,
        undefined,
        409
      )
    }

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

  // Wrap in transaction: prevent two concurrent admin actions both passing the PENDING check.
  const doWrites = async (tx: DatabaseClient) => {
    const excuseRequest = await getExcuseRequestById(excuseRequestId, tx)
    if (!excuseRequest) {
      throw new ActionError('Excuse request not found', ERROR_CODES.EXCUSE_REQUEST_NOT_FOUND)
    }
    if (excuseRequest.status !== 'PENDING') {
      throw new ActionError(
        `Excuse request is already ${excuseRequest.status}`,
        ERROR_CODES.INVALID_TRANSITION
      )
    }

    const updated = await tx.excuseRequest.update({
      where: { id: excuseRequestId },
      data: { status: 'REJECTED', adminNote: adminNote ?? null, reviewedBy, reviewedAt: new Date() },
    })

    logger.info(
      { event: 'EXCUSE_REJECTED', excuseRequestId, reviewedBy },
      'Admin rejected excuse request'
    )

    return updated
  }

  return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
}
