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
  EXPECTED: ['PRESENT', 'LATE', 'ABSENT', 'CLOSED'],
  PRESENT: ['ABSENT', 'EXCUSED', 'CLOSED', 'LATE'],
  LATE: ['ABSENT', 'EXCUSED', 'CLOSED', 'PRESENT'],
  ABSENT: ['LATE', 'EXCUSED', 'CLOSED'],
  EXCUSED: ['LATE', 'ABSENT', 'CLOSED'],
  // CLOSED → PRESENT: admin confirms teacher showed up on a closed day.
  // CLOSED → EXPECTED is intentionally excluded: it would leave the record
  // in EXPECTED while the SchoolClosure row still exists, causing the cron
  // to skip auto-mark and leaving the slot stuck. Use removeClosure() to
  // revert CLOSED records to EXPECTED for the whole date.
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
