/**
 * Teacher Attendance Status Transition Guard
 *
 * Pure functions — no DB calls, no side effects.
 * All status transition validation lives here so the service layer
 * and any future callers share one source of truth.
 */

import type { TeacherAttendanceStatus } from '@prisma/client'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

const ALLOWED_TRANSITIONS: Record<TeacherAttendanceStatus, TeacherAttendanceStatus[]> = {
  // EXPECTED → CLOSED: markDateClosed propagates this in bulk; admin can also
  //   close a single slot that was missed by the bulk operation.
  EXPECTED: ['PRESENT', 'LATE', 'ABSENT', 'CLOSED'],
  // PRESENT/LATE/ABSENT/EXCUSED → CLOSED intentionally excluded: a teacher who
  //   already has concrete attendance data (showed up, was excused, etc.) cannot
  //   be reverted to CLOSED via the override dialog. Use removeClosure() + the
  //   natural record if the whole day needs to be reopened.
  PRESENT: ['ABSENT', 'EXCUSED', 'LATE'],
  // LATE → LATE: self-checkin can update clockInTime/source on an auto-marked LATE record
  //   without changing the displayed status.
  LATE: ['ABSENT', 'EXCUSED', 'PRESENT', 'LATE'],
  // ABSENT → PRESENT: admin corrects an auto-marked absence when the teacher
  //   physically showed up after the auto-mark window fired.
  ABSENT: ['LATE', 'EXCUSED', 'PRESENT'],
  // EXCUSED → LATE/ABSENT: admin reverts an erroneously approved excuse.
  // transitionStatus atomically rejects any APPROVED ExcuseRequest in the same
  // transaction so the teacher isn't left in a dead-end (can't resubmit because
  // getExistingActiveExcuse would find the orphaned APPROVED row).
  EXCUSED: ['LATE', 'ABSENT'],
  // CLOSED → PRESENT: admin confirms teacher physically showed up on a closed day.
  // This transition goes through transitionStatus (override dialog), which only updates
  // TeacherAttendanceRecord — no DugsiTeacherCheckIn fact-log row is created. The result
  // is a PRESENT record with checkInId = null and clockInTime = null. The ADMIN_OVERRIDE
  // source distinguishes these fact-log-less records from SELF_CHECKIN entries in the
  // audit trail. If a clock-in fact-log is required, use adminCheckIn instead.
  // CLOSED → EXPECTED is excluded: it would leave the record in EXPECTED while the
  //   SchoolClosure row still exists. Use removeClosure() to revert the whole date.
  CLOSED: ['PRESENT'],
}

export function isValidTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function getAllowedTransitions(
  from: TeacherAttendanceStatus
): TeacherAttendanceStatus[] {
  return ALLOWED_TRANSITIONS[from]
}

export function assertValidTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new ActionError(
      `Invalid attendance transition: ${from} → ${to}. Allowed: ${ALLOWED_TRANSITIONS[from].join(', ')}`,
      ERROR_CODES.INVALID_TRANSITION,
      undefined,
      422
    )
  }
}
