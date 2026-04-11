import { Shift } from '@prisma/client'
import { format, isValid, parseISO } from 'date-fns'
import { z } from 'zod'

// Validates format AND semantic correctness, including overflow dates.
// `new Date('2026-02-29')` silently becomes 2026-03-01 — the round-trip check
// via date-fns rejects it because format(parseISO(d)) !== d.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((d) => {
    const p = parseISO(d)
    return isValid(p) && format(p, 'yyyy-MM-dd') === d
  }, 'Invalid date')

// School runs Saturday (6) and Sunday (0) only.
// T12:00:00Z anchors the parse to UTC noon to avoid timezone edge cases.
const weekendDateString = dateString.refine(
  (d) => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()),
  'School days are Saturday and Sunday only'
)

// Only statuses that are legitimate override targets from the admin dialog.
// EXPECTED (slot generation) and CLOSED (markDateClosed) have dedicated flows
// and should never appear as manual override targets.
const OVERRIDEABLE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const

export const OverrideAttendanceStatusSchema = z.object({
  recordId: z.string().uuid(),
  toStatus: z.enum(OVERRIDEABLE_STATUSES),
  notes: z.string().max(500).optional(),
})

export const AdminCheckInSchema = z.object({
  teacherId: z.string().uuid(),
  shift: z.nativeEnum(Shift),
  date: weekendDateString,
})

export const MarkDateClosedSchema = z.object({
  date: weekendDateString,
  reason: z.string().min(3).max(500),
})

export const RemoveClosureSchema = z.object({
  date: weekendDateString,
})

export const UpdateAttendanceConfigSchema = z.object({
  // max(120): derived from the cron schedule ("0 21 * * 0,6" = 21:00 UTC = 15:00 CST).
  // Formula: max = (cron_fire_CST_minutes_from_midnight) - (class_start_CST_minutes_from_midnight) - 1
  //        = (15 * 60 + 0) - (9 * 60 + 0) - 1 = 900 - 540 - 1 = 359
  // 120 is well within the 359-minute ceiling; it keeps the window sane (2 hours max).
  // COUPLING: if the cron schedule or morning class start time changes, recalculate above.
  morningAutoMarkMinutes: z.number().int().min(0).max(120),
  // max(89): derived from the cron schedule in vercel.json ("0 21 * * 0,6" = 21:00 UTC).
  // Formula: max = (cron_fire_CST_minutes_from_midnight) - (class_start_CST_minutes_from_midnight) - 1
  //        = (15 * 60 + 0) - (13 * 60 + 30) - 1 = 900 - 810 - 1 = 89
  // Result: 13:30 CST + 89 min = 14:59 CST = 20:59 UTC — 1 minute before the cron fires.
  // Note: the 1-minute margin is CST-only (winter). In CDT the cron fires at 16:00 CDT,
  // giving a 61-minute margin — but always derive from CST (UTC-6) for worst-case safety.
  // COUPLING: if the cron schedule in vercel.json changes, recalculate using the formula above.
  // MIGRATION NOTE: max(89) prevents *saving* an out-of-range value but does not fix an already-
  // stored value that becomes invalid after a schedule change. DugsiAttendanceConfig is a
  // singleton that persists across deploys — pair any cron schedule change with a migration
  afternoonAutoMarkMinutes: z.number().int().min(0).max(89),
})

export const GenerateExpectedSlotsSchema = z.object({
  date: weekendDateString,
})

// teacherId is included as a self-consistency check (stop-gap until session auth in #225):
// the server resolves the true teacherId from the record and asserts it matches the
// client-supplied value. An attacker must now know both the recordId AND the correct
// teacherId — but this doesn't fix the underlying spoofability without session auth.
export const SubmitExcuseSchema = z.object({
  attendanceRecordId: z.string().uuid(),
  teacherId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
})

export const ReviewExcuseSchema = z.object({
  excuseRequestId: z.string().uuid(),
  adminNote: z.string().min(1).max(500).optional(),
})

export type OverrideAttendanceStatusInput = z.infer<
  typeof OverrideAttendanceStatusSchema
>
export type AdminCheckInInput = z.infer<typeof AdminCheckInSchema>
export type MarkDateClosedInput = z.infer<typeof MarkDateClosedSchema>
export type RemoveClosureInput = z.infer<typeof RemoveClosureSchema>
export type UpdateAttendanceConfigInput = z.infer<
  typeof UpdateAttendanceConfigSchema
>
export type SubmitExcuseInput = z.infer<typeof SubmitExcuseSchema>
export type ReviewExcuseInput = z.infer<typeof ReviewExcuseSchema>
