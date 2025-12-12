/**
 * Billing Validation Schemas
 *
 * Zod validation for billing-related inputs including
 * billing start dates and override amounts.
 */

import { z } from 'zod'

import {
  MAX_BILLING_START_DAY,
  MAX_BILLING_ANCHOR_DAYS,
} from '@/lib/utils/billing-date'

/**
 * Schema for validating billing start date ISO strings.
 *
 * Validates:
 * - Valid ISO 8601 date string format
 * - Date is in the future
 * - Date is within MAX_BILLING_ANCHOR_DAYS (1 year)
 */
export const BillingStartDateSchema = z
  .string()
  .datetime({ message: 'Invalid date format. Expected ISO 8601 string.' })
  .refine(
    (dateStr) => {
      const date = new Date(dateStr)
      return date.getTime() > Date.now()
    },
    { message: 'Billing start date must be in the future' }
  )
  .refine(
    (dateStr) => {
      const date = new Date(dateStr)
      const maxDate = new Date(
        Date.now() + MAX_BILLING_ANCHOR_DAYS * 24 * 60 * 60 * 1000
      )
      return date.getTime() <= maxDate.getTime()
    },
    { message: 'Billing start date must be within 1 year' }
  )
  .optional()

/**
 * Schema for validating billing day (1-15).
 * Used for Select dropdown validation.
 */
export const BillingDaySchema = z
  .number()
  .int('Billing day must be a whole number')
  .min(1, 'Billing day must be at least 1')
  .max(
    MAX_BILLING_START_DAY,
    `Billing day cannot exceed ${MAX_BILLING_START_DAY}`
  )

/**
 * Hard cap for override amounts in cents.
 * This is a sanity check to catch typos, not a business rule.
 * Program-specific limits (Mahad $220, Dugsi $650) are enforced separately.
 */
export const MAX_OVERRIDE_AMOUNT_CENTS = 100000

/**
 * Schema for validating override amounts in cents.
 * Used for custom rate validation.
 */
export const OverrideAmountSchema = z
  .number()
  .int('Override amount must be in cents (whole number)')
  .positive('Override amount must be positive')
  .max(
    MAX_OVERRIDE_AMOUNT_CENTS,
    `Override amount cannot exceed $${MAX_OVERRIDE_AMOUNT_CENTS / 100}`
  )

/**
 * Combined schema for payment link generation input.
 * Can be extended by Mahad/Dugsi specific schemas.
 */
export const PaymentLinkInputSchema = z.object({
  overrideAmount: OverrideAmountSchema.optional(),
  billingStartDate: BillingStartDateSchema,
})

export type PaymentLinkInput = z.infer<typeof PaymentLinkInputSchema>
