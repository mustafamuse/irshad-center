/**
 * Dugsi Program Validation Schemas
 *
 * Zod validation schemas for Dugsi program operations.
 */

import { Shift } from '@prisma/client'
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
  shift: z.nativeEnum(Shift, {
    errorMap: () => ({ message: 'Shift must be MORNING or AFTERNOON' }),
  }),
})

// ============================================================================
// SEARCH PARAMS VALIDATION
// ============================================================================

export const ShiftFilterSchema = z
  .enum([Shift.MORNING, Shift.AFTERNOON, SHIFT_FILTER_ALL])
  .optional()
  .transform((val) => {
    if (!val || val === SHIFT_FILTER_ALL) return undefined
    return val
  })

// ============================================================================
// SERVICE LAYER VALIDATION
// ============================================================================

export const DugsiRegistrationFiltersSchema = z.object({
  shift: z.enum([Shift.MORNING, Shift.AFTERNOON]).optional(),
})

// ============================================================================
// BILLING CONTROL VALIDATION
// ============================================================================

export const FamilyBillingControlSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
})

export const PauseFamilyBillingSchema = FamilyBillingControlSchema
export const ResumeFamilyBillingSchema = FamilyBillingControlSchema

// ============================================================================
// WITHDRAWAL VALIDATION
// ============================================================================

export const WithdrawChildrenSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID format'))
    .min(1, 'At least one child must be selected for withdrawal'),
})

export const WithdrawalPreviewSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID format'))
    .min(1, 'At least one child must be selected'),
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type UpdateFamilyShiftInput = z.infer<typeof UpdateFamilyShiftSchema>
export type DugsiRegistrationFilters = z.infer<
  typeof DugsiRegistrationFiltersSchema
>
export type WithdrawChildrenInput = z.infer<typeof WithdrawChildrenSchema>
export type WithdrawalPreviewInput = z.infer<typeof WithdrawalPreviewSchema>
