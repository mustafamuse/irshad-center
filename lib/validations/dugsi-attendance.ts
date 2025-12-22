import { Shift, DugsiAttendanceStatus } from '@prisma/client'
import { z } from 'zod'

export const CreateDugsiClassSchema = z.object({
  name: z.string().min(1).max(100),
  shift: z.nativeEnum(Shift),
  description: z.string().max(500).optional(),
})

export const UpdateDugsiClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  shift: z.nativeEnum(Shift).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

export const AssignStudentToClassSchema = z.object({
  classId: z.string().uuid(),
  programProfileId: z.string().uuid(),
})

export const CreateSessionSchema = z.object({
  classId: z.string().uuid(),
  teacherId: z.string().uuid(),
  date: z.date().optional(),
  notes: z.string().max(500).optional(),
})

export const AttendanceRecordInputSchema = z
  .object({
    programProfileId: z.string().uuid(),
    status: z.nativeEnum(DugsiAttendanceStatus),
    lessonCompleted: z.boolean().optional().default(false),
    surahName: z.string().max(100).optional(),
    ayatFrom: z.number().int().min(1).optional(),
    ayatTo: z.number().int().min(1).optional(),
    lessonNotes: z.string().max(500).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => !data.ayatFrom || !data.ayatTo || data.ayatFrom <= data.ayatTo,
    {
      message: 'ayatFrom must be less than or equal to ayatTo',
      path: ['ayatTo'],
    }
  )

export const MarkAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  records: z.array(AttendanceRecordInputSchema).min(1),
})

export const AttendanceFilterSchema = z.object({
  classId: z.string().uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

export const ClockInSchema = z.object({
  teacherId: z.string().uuid(),
  shift: z.nativeEnum(Shift),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const ClockOutSchema = z.object({
  checkInId: z.string().uuid(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export type CreateDugsiClassInput = z.infer<typeof CreateDugsiClassSchema>
export type UpdateDugsiClassInput = z.infer<typeof UpdateDugsiClassSchema>
export type AssignStudentInput = z.infer<typeof AssignStudentToClassSchema>
export type ClockInInput = z.infer<typeof ClockInSchema>
export type ClockOutInput = z.infer<typeof ClockOutSchema>
