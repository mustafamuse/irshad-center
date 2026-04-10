import { Shift, TeacherAttendanceStatus } from '@prisma/client'
import { z } from 'zod'

// Validates format AND semantic correctness (e.g. rejects 2026-13-99)
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((d) => !isNaN(new Date(d).getTime()), 'Invalid date')

export const OverrideAttendanceStatusSchema = z.object({
  recordId: z.string().uuid(),
  toStatus: z.nativeEnum(TeacherAttendanceStatus),
  notes: z.string().max(500).optional(),
})

export const AdminCheckInSchema = z.object({
  teacherId: z.string().uuid(),
  shift: z.nativeEnum(Shift),
  date: dateString,
})

export const MarkDateClosedSchema = z.object({
  date: dateString,
  reason: z.string().min(3).max(500),
})

export const RemoveClosureSchema = z.object({
  date: dateString,
})

export const UpdateAttendanceConfigSchema = z.object({
  morningAutoMarkMinutes: z.number().int().min(0).max(120),
  afternoonAutoMarkMinutes: z.number().int().min(0).max(120),
})

export const GenerateExpectedSlotsSchema = z.object({
  date: dateString,
})

// teacherId intentionally omitted — resolved server-side from the attendanceRecordId
// so the server never trusts client-supplied identity
export const SubmitExcuseSchema = z.object({
  attendanceRecordId: z.string().uuid(),
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
