/**
 * Dugsi Checkout Request Validation Schema
 *
 * Zod validation for Dugsi checkout API requests.
 * Ensures type safety and validates input at runtime.
 */

import { z } from 'zod'

import { MAX_EXPECTED_FAMILY_RATE } from '@/lib/utils/dugsi-tuition'

/**
 * Schema for Dugsi checkout session requests
 *
 * Validates:
 * - familyId is a valid UUID
 * - childCount is a positive integer (1-15)
 * - overrideAmount is valid if provided (positive integer, reasonable range)
 * - successUrl/cancelUrl are valid URLs if provided
 */
export const DugsiCheckoutRequestSchema = z.object({
  familyId: z.string().uuid('Invalid family ID format'),
  // childCount is optional - server uses familyProfiles.length as authoritative source
  // Client may pass it for UI hints, but it's not used for pricing (security fix)
  childCount: z
    .number()
    .int('Child count must be a whole number')
    .min(1, 'At least 1 child is required')
    .max(15, 'Maximum 15 children per family')
    .optional(),
  overrideAmount: z
    .number()
    .int('Override amount must be a whole number (in cents)')
    .min(1, 'Override amount must be positive')
    .max(
      MAX_EXPECTED_FAMILY_RATE * 2,
      `Override amount exceeds maximum allowed (${MAX_EXPECTED_FAMILY_RATE * 2} cents)`
    )
    .optional(),
  successUrl: z
    .string()
    .url('Invalid success URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'Success URL must use HTTP or HTTPS protocol'
    )
    .optional(),
  cancelUrl: z
    .string()
    .url('Invalid cancel URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'Cancel URL must use HTTP or HTTPS protocol'
    )
    .optional(),
})

export type DugsiCheckoutRequestInput = z.infer<
  typeof DugsiCheckoutRequestSchema
>

/**
 * Schema for admin-generated payment link requests
 *
 * Validates:
 * - familyId is a valid UUID
 * - childCount is a positive integer
 * - overrideAmount is valid if provided
 * - email is valid if provided (for sending payment link)
 */
export const GeneratePaymentLinkSchema = z.object({
  familyId: z.string().uuid('Invalid family ID format'),
  childCount: z
    .number()
    .int('Child count must be a whole number')
    .min(1, 'At least 1 child is required')
    .max(15, 'Maximum 15 children per family'),
  overrideAmount: z
    .number()
    .int('Override amount must be a whole number (in cents)')
    .min(1, 'Override amount must be positive')
    .max(
      MAX_EXPECTED_FAMILY_RATE * 2,
      `Override amount exceeds maximum allowed`
    )
    .optional(),
  contactEmail: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .optional(),
})

export type GeneratePaymentLinkInput = z.infer<typeof GeneratePaymentLinkSchema>
