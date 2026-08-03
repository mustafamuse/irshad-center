/**
 * Dugsi Program Validation Schemas
 *
 * Zod validation schemas for Dugsi program operations.
 */

import { Shift } from '@prisma/client'
import { z } from 'zod'

import { SHIFT_FILTER_ALL, WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'

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

const uniqueProfileIds = (ids: string[]) => new Set(ids).size === ids.length

export const WithdrawChildrenSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID format'))
    .min(1, 'At least one child must be selected for withdrawal')
    .max(50, 'Too many children selected')
    .refine(uniqueProfileIds, 'Duplicate children selected'),
  reason: z.enum(WITHDRAWAL_REASONS, {
    errorMap: () => ({ message: 'Select a withdrawal reason' }),
  }),
  note: z.string().max(200, 'Note is too long').optional(),
})

export const WithdrawalPreviewSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID format'))
    .min(1, 'At least one child must be selected')
    .max(50, 'Too many children selected')
    .refine(uniqueProfileIds, 'Duplicate children selected'),
})

export function formatWithdrawalReason(reason: string, note?: string): string {
  const trimmed = note?.trim()
  return trimmed ? `${reason}: ${trimmed}` : reason
}

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type UpdateFamilyShiftInput = z.infer<typeof UpdateFamilyShiftSchema>
export type DugsiRegistrationFilters = z.infer<
  typeof DugsiRegistrationFiltersSchema
>
export type WithdrawChildrenInput = z.infer<typeof WithdrawChildrenSchema>
export type WithdrawalPreviewInput = z.infer<typeof WithdrawalPreviewSchema>
