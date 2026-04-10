import { Shift, TeacherAttendanceStatus } from '@prisma/client'
import { z } from 'zod'

export const OverrideAttendanceStatusSchema = z.object({
  recordId: z.string().uuid(),
  toStatus: z.nativeEnum(TeacherAttendanceStatus),
  notes: z.string().max(500).optional(),
})

export const AdminCheckInSchema = z.object({
  teacherId: z.string().uuid(),
  shift: z.nativeEnum(Shift),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

export const MarkDateClosedSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  reason: z.string().min(3).max(500),
})

export const RemoveClosureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

export const UpdateAttendanceConfigSchema = z.object({
  morningAutoMarkMinutes: z.number().int().min(0).max(120),
  afternoonAutoMarkMinutes: z.number().int().min(0).max(120),
})

export const GenerateExpectedSlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

// teacherId is required because the teacher app has no auth — teachers identify via dropdown
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
