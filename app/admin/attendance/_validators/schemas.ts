import { z } from 'zod'

// Base Schemas
const baseRecordSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// Enum Schemas
export const attendanceStatusSchema = z.enum([
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
])

// Request Schemas
export const markAttendanceSchema = z.object({
  date: z.coerce.date(),
  batchId: z.string().uuid(),
  attendance: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      notes: z.string().optional(),
    })
  ),
})

export const attendanceFiltersSchema = z
  .object({
    batchId: z.string().uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )

// Response Schemas
export const studentSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  email: z.string().email(),
  rollNumber: z.string().optional(),
  batchId: z.string().uuid(),
})

export const attendanceRecordSchema = baseRecordSchema.extend({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  notes: z.string().optional(),
})

export const attendanceSummarySchema = z
  .object({
    total: z.number().int().min(0),
    present: z.number().int().min(0),
    absent: z.number().int().min(0),
    late: z.number().int().min(0),
    excused: z.number().int().min(0),
  })
  .refine(
    (data) => {
      const { total, present, absent, late, excused } = data
      return total === present + absent + late + excused
    },
    {
      message: 'Summary counts do not match total',
    }
  )

export const attendanceSessionSchema = baseRecordSchema.extend({
  date: z.coerce.date(),
  batchId: z.string().uuid(),
  notes: z.string().optional(),
  records: z.array(attendanceRecordSchema),
  summary: attendanceSummarySchema,
})

// API Response Schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.string().optional(),
})

export const attendanceHistoryResponseSchema = apiResponseSchema.extend({
  data: z.array(attendanceSessionSchema),
})

export const studentsResponseSchema = apiResponseSchema.extend({
  data: z.array(studentSchema),
})

// Type Guards
export const isAttendanceSession = (
  value: unknown
): value is z.infer<typeof attendanceSessionSchema> => {
  return attendanceSessionSchema.safeParse(value).success
}

export const isStudent = (
  value: unknown
): value is z.infer<typeof studentSchema> => {
  return studentSchema.safeParse(value).success
}

// Helper Types
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>
export type MarkAttendanceRequest = z.infer<typeof markAttendanceSchema>
export type AttendanceFilters = z.infer<typeof attendanceFiltersSchema>
export type Student = z.infer<typeof studentSchema>
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>
export type AttendanceSession = z.infer<typeof attendanceSessionSchema>
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>

// Error Handling
export class ValidationError extends Error {
  constructor(public errors: z.ZodError) {
    super('Validation Error')
    this.name = 'ValidationError'
  }
}

export function validateMarkAttendance(data: unknown): MarkAttendanceRequest {
  const result = markAttendanceSchema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(result.error)
  }
  return result.data
}

export function validateAttendanceFilters(data: unknown): AttendanceFilters {
  const result = attendanceFiltersSchema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(result.error)
  }
  return result.data
}
