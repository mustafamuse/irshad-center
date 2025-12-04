/**
 * Dugsi Program Validation Schemas
 *
 * Zod validation schemas for Dugsi program operations.
 */

import { StudentShift } from '@prisma/client'
import { z } from 'zod'

import { SHIFT_FILTER_ALL } from '@/lib/constants/dugsi'

// ============================================================================
// FAMILY SHIFT VALIDATION
// ============================================================================

export const UpdateFamilyShiftSchema = z.object({
  familyReferenceId: z
    .string()
    .uuid('Invalid family reference ID format')
    .min(1, 'Family reference ID is required'),
  shift: z.nativeEnum(StudentShift, {
    errorMap: () => ({ message: 'Shift must be MORNING or AFTERNOON' }),
  }),
})

// ============================================================================
// SEARCH PARAMS VALIDATION
// ============================================================================

export const ShiftFilterSchema = z
  .enum([StudentShift.MORNING, StudentShift.AFTERNOON, SHIFT_FILTER_ALL])
  .optional()
  .transform((val) => {
    if (!val || val === SHIFT_FILTER_ALL) return undefined
    return val
  })

// ============================================================================
// SERVICE LAYER VALIDATION
// ============================================================================

export const DugsiRegistrationFiltersSchema = z.object({
  shift: z.enum([StudentShift.MORNING, StudentShift.AFTERNOON]).optional(),
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type UpdateFamilyShiftInput = z.infer<typeof UpdateFamilyShiftSchema>
export type DugsiRegistrationFilters = z.infer<
  typeof DugsiRegistrationFiltersSchema
>
