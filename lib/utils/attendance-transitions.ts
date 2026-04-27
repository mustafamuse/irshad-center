import type { AttendanceSource, TeacherAttendanceStatus } from '@prisma/client'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

// ─── Teacher (self-checkin) ────────────────────────────────────────────────
//
// Teachers may only clock in to PRESENT or LATE. Provenance matters:
// ADMIN_OVERRIDE-sourced ABSENT cannot be reversed by self-checkin.
// CLOSED is caught before this check (SCHOOL_CLOSED error).
// Already-PRESENT teachers are caught by DUPLICATE_CHECKIN before this check.

const TEACHER_TRANSITIONS: Partial<
  Record<TeacherAttendanceStatus, TeacherAttendanceStatus[]>
> = {
  EXPECTED: ['PRESENT', 'LATE'],
  LATE: ['LATE', 'PRESENT'], // LATE→LATE: update clockInTime on auto-marked record
  ABSENT: ['PRESENT', 'LATE'], // physically shows up after cron auto-mark (SYSTEM source)
}

export function canTeacherTransition(
  from: TeacherAttendanceStatus,
  fromSource: AttendanceSource | null,
  to: TeacherAttendanceStatus
): boolean {
  // Admin set this ABSENT explicitly — self-checkin cannot reverse that decision.
  if (from === 'ABSENT' && fromSource === 'ADMIN_OVERRIDE') return false
  return TEACHER_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Admin (override dialog, adminCheckIn, deleteCheckin, excuse approval) ──
//
// EXPECTED→CLOSED is excluded: markDateClosed is the only valid path to CLOSED,
// and it bypasses this table intentionally (see school-closure-service.ts).

const ADMIN_TRANSITIONS: Record<
  TeacherAttendanceStatus,
  TeacherAttendanceStatus[]
> = {
  EXPECTED: ['PRESENT', 'LATE', 'ABSENT'],
  PRESENT: ['ABSENT', 'LATE'],
  LATE: ['ABSENT', 'EXCUSED', 'PRESENT', 'LATE'],
  ABSENT: ['LATE', 'EXCUSED', 'PRESENT'],
  EXCUSED: ['LATE', 'ABSENT'],
  CLOSED: ['PRESENT'],
}

export function canAdminTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus
): boolean {
  return ADMIN_TRANSITIONS[from].includes(to)
}

export function assertAdminTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus
): void {
  if (!canAdminTransition(from, to)) {
    throw new ActionError(
      `Invalid attendance transition: ${from} → ${to}. Allowed: ${ADMIN_TRANSITIONS[from].join(', ')}`,
      ERROR_CODES.INVALID_TRANSITION,
      undefined,
      422
    )
  }
}

export function getAdminAllowedTransitions(
  from: TeacherAttendanceStatus
): TeacherAttendanceStatus[] {
  return ADMIN_TRANSITIONS[from]
}

// ─── System (closure propagation, excuse approval) ────────────────────────
//
// Auto-mark (EXPECTED→LATE via cron) uses raw updateMany — minutesLate handling
// requires explicit field control that the generic transition path cannot provide.
// Closure restore (CLOSED→previousStatus) is similarly a raw updateMany in
// school-closure-service.ts to support per-row previousStatus restoration.

export type SystemAction = 'closure_mark' | 'excuse_approval'

const SYSTEM_TRANSITIONS: Record<
  SystemAction,
  Partial<Record<TeacherAttendanceStatus, TeacherAttendanceStatus[]>>
> = {
  closure_mark: {
    EXPECTED: ['CLOSED'],
  },
  excuse_approval: {
    LATE: ['EXCUSED'],
    ABSENT: ['EXCUSED'],
  },
}

export function canSystemTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus,
  action: SystemAction
): boolean {
  return SYSTEM_TRANSITIONS[action][from]?.includes(to) ?? false
}

export function assertSystemTransition(
  from: TeacherAttendanceStatus,
  to: TeacherAttendanceStatus,
  action: SystemAction
): void {
  if (!canSystemTransition(from, to, action)) {
    const allowed = SYSTEM_TRANSITIONS[action][from]?.join(', ') ?? 'none'
    throw new ActionError(
      `Invalid system transition (${action}): ${from} → ${to}. Allowed: ${allowed}`,
      ERROR_CODES.INVALID_TRANSITION,
      undefined,
      422
    )
  }
}
