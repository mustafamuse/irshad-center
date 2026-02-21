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
// WITHDRAWAL / RE-ENROLLMENT VALIDATION
// ============================================================================

const BillingAdjustmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto_recalculate') }),
  z.object({ type: z.literal('cancel_subscription') }),
])

export const WithdrawChildSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  reason: z.enum([
    'family_moved',
    'financial',
    'behavioral',
    'seasonal_break',
    'other',
  ]),
  reasonNote: z.string().max(500).optional(),
  billingAdjustment: BillingAdjustmentSchema,
})

export const WithdrawFamilySchema = z.object({
  familyReferenceId: z.string().min(1, 'Family reference ID is required'),
  reason: z.enum([
    'family_moved',
    'financial',
    'behavioral',
    'seasonal_break',
    'other',
  ]),
  reasonNote: z.string().max(500).optional(),
})

export const ReEnrollChildSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
})

export const GetWithdrawPreviewSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
})

export const PauseFamilyBillingSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
})

export const ResumeFamilyBillingSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type UpdateFamilyShiftInput = z.infer<typeof UpdateFamilyShiftSchema>
export type DugsiRegistrationFilters = z.infer<
  typeof DugsiRegistrationFiltersSchema
>
export type WithdrawChildInput = z.infer<typeof WithdrawChildSchema>
export type WithdrawFamilyInput = z.infer<typeof WithdrawFamilySchema>
export type ReEnrollChildInput = z.infer<typeof ReEnrollChildSchema>
