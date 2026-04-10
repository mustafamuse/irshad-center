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
  morningAutoMarkMinutes: z.number().int().min(0).max(120),
  afternoonAutoMarkMinutes: z.number().int().min(0).max(89), // 1:30 PM + 89 min = 3:00 PM CST ≤ 21:00 UTC (cron time)
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
  adminNote: z.string().max(500).optional(),
})

export type OverrideAttendanceStatusInput = z.infer<typeof OverrideAttendanceStatusSchema>
export type AdminCheckInInput = z.infer<typeof AdminCheckInSchema>
export type MarkDateClosedInput = z.infer<typeof MarkDateClosedSchema>
export type RemoveClosureInput = z.infer<typeof RemoveClosureSchema>
export type UpdateAttendanceConfigInput = z.infer<typeof UpdateAttendanceConfigSchema>
export type SubmitExcuseInput = z.infer<typeof SubmitExcuseSchema>
export type ReviewExcuseInput = z.infer<typeof ReviewExcuseSchema>
