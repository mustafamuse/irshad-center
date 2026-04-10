/**
 * Teacher Attendance Status Transition Guard
 *
 * Pure functions — no DB calls, no side effects.
 * All status transition validation lives here so the service layer
 * and any future callers share one source of truth.
 */

import type { TeacherAttendanceStatus } from '@prisma/client'

const ALLOWED_TRANSITIONS: Record<TeacherAttendanceStatus, TeacherAttendanceStatus[]> = {
  EXPECTED: ['PRESENT', 'LATE', 'CLOSED'],
  PRESENT: ['ABSENT', 'EXCUSED', 'CLOSED', 'LATE'],
  LATE: ['ABSENT', 'EXCUSED', 'CLOSED', 'PRESENT'],
  ABSENT: ['LATE', 'EXCUSED', 'CLOSED'],
  EXCUSED: ['LATE', 'ABSENT', 'CLOSED'],
  CLOSED: ['EXPECTED'],
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
    throw new Error(
      `Invalid attendance transition: ${from} → ${to}. Allowed: ${ALLOWED_TRANSITIONS[from].join(', ')}`
    )
  }
}
