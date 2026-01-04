/**
 * Teacher Check-in Validation Schemas
 *
 * Zod validation schemas for teacher check-in operations.
 */

import { Shift } from '@prisma/client'
import { z } from 'zod'

// ============================================================================
// CLOCK IN/OUT VALIDATION
// ============================================================================

/**
 * Schema for teacher clock-in requests.
 * GPS coordinates are required - check-in is blocked without location.
 */
export const ClockInSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format'),
  shift: z.nativeEnum(Shift, {
    errorMap: () => ({ message: 'Shift must be MORNING or AFTERNOON' }),
  }),
  latitude: z.number({
    required_error: 'GPS location is required',
    invalid_type_error: 'Invalid latitude',
  }),
  longitude: z.number({
    required_error: 'GPS location is required',
    invalid_type_error: 'Invalid longitude',
  }),
})

/**
 * Schema for teacher clock-out requests.
 * GPS coordinates are optional for clock-out.
 */
export const ClockOutSchema = z.object({
  checkInId: z.string().uuid('Invalid check-in ID format'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

// ============================================================================
// ADMIN UPDATE VALIDATION
// ============================================================================

/**
 * Schema for admin updates to check-in records.
 */
export const UpdateCheckinSchema = z.object({
  checkInId: z.string().uuid('Invalid check-in ID format'),
  clockInTime: z.coerce.date().optional(),
  clockOutTime: z.coerce.date().nullable().optional(),
  isLate: z.boolean().optional(),
  clockInValid: z.boolean().optional(),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or less')
    .nullable()
    .optional(),
})

// ============================================================================
// QUERY FILTER VALIDATION
// ============================================================================

/**
 * Schema for check-in history filters.
 */
export const CheckinHistoryFiltersSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  shift: z.nativeEnum(Shift).optional(),
  teacherId: z.string().uuid().optional(),
  isLate: z.boolean().optional(),
  clockInValid: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
})

/**
 * Schema for late arrivals report filters.
 */
export const LateReportFiltersSchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  shift: z.nativeEnum(Shift).optional(),
  teacherId: z.string().uuid().optional(),
})

/**
 * Schema for single date check-in query.
 */
export const DateCheckinFiltersSchema = z.object({
  date: z.coerce.date().optional(),
  shift: z.nativeEnum(Shift).optional(),
  teacherId: z.string().uuid().optional(),
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type ClockInInput = z.infer<typeof ClockInSchema>
export type ClockOutInput = z.infer<typeof ClockOutSchema>
export type UpdateCheckinInput = z.infer<typeof UpdateCheckinSchema>
export type CheckinHistoryFilters = z.infer<typeof CheckinHistoryFiltersSchema>
export type LateReportFilters = z.infer<typeof LateReportFiltersSchema>
export type DateCheckinFilters = z.infer<typeof DateCheckinFiltersSchema>
