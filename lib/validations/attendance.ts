import { DugsiAttendanceStatus } from '@prisma/client'
import { z } from 'zod'

export const CreateSessionSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  date: z.coerce.date().refine(
    (date) => {
      const day = date.getUTCDay()
      return day === 0 || day === 6
    },
    {
      message:
        'Dugsi sessions can only be created on weekends (Saturday or Sunday)',
    }
  ),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be 500 characters or less')
    .optional(),
})

export const MarkAttendanceSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  records: z.array(
    z
      .object({
        programProfileId: z.string().uuid('Invalid profile ID'),
        status: z.nativeEnum(DugsiAttendanceStatus, {
          errorMap: () => ({ message: 'Invalid attendance status' }),
        }),
        lessonCompleted: z.boolean().optional(),
        surahName: z
          .string()
          .trim()
          .max(100, 'Surah name must be 100 characters or less')
          .optional(),
        ayatFrom: z.coerce.number().int().positive().optional(),
        ayatTo: z.coerce.number().int().positive().optional(),
        lessonNotes: z
          .string()
          .trim()
          .max(500, 'Lesson notes must be 500 characters or less')
          .optional(),
        notes: z
          .string()
          .trim()
          .max(500, 'Notes must be 500 characters or less')
          .optional(),
      })
      .refine((r) => (r.ayatFrom != null) === (r.ayatTo != null), {
        message: 'Both ayatFrom and ayatTo must be provided together',
        path: ['ayatFrom'],
      })
      .refine((r) => !(r.ayatFrom && r.ayatTo && r.ayatFrom > r.ayatTo), {
        message: 'ayatFrom must be less than or equal to ayatTo',
        path: ['ayatTo'],
      })
  ),
})

export const DeleteSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const AttendanceFiltersSchema = z.object({
  classId: z.string().uuid('Invalid class ID').optional(),
  teacherId: z.string().uuid('Invalid teacher ID').optional(),
  dateFrom: z.coerce
    .date({ errorMap: () => ({ message: 'Invalid start date' }) })
    .optional(),
  dateTo: z.coerce
    .date({ errorMap: () => ({ message: 'Invalid end date' }) })
    .optional(),
  page: z.coerce
    .number()
    .int()
    .positive('Page must be positive')
    .optional()
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(50),
})

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>
export type DeleteSessionInput = z.infer<typeof DeleteSessionSchema>
export const LoadMoreHistorySchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  offset: z.number().int().nonnegative('Offset must be non-negative'),
})

export type AttendanceFiltersInput = z.infer<typeof AttendanceFiltersSchema>
export type LoadMoreHistoryInput = z.infer<typeof LoadMoreHistorySchema>
