/**
 * Mahad Tuition Rate Calculation
 *
 * Calculates tuition rates for Mahad students based on:
 * - Graduation status (NON_GRADUATE vs GRADUATE)
 * - Payment frequency (MONTHLY vs BI_MONTHLY)
 * - Billing type (FULL_TIME, FULL_TIME_SCHOLARSHIP, PART_TIME, EXEMPT)
 *
 * Rate formula:
 * 1. Get base rate by graduation status and frequency
 * 2. Apply modifier based on billing type:
 *    - FULL_TIME: 100% of base
 *    - FULL_TIME_SCHOLARSHIP: base - $30
 *    - PART_TIME: 50% of base
 *    - EXEMPT: $0 (no subscription)
 *
 * NOTE: Part-time and Scholarship are mutually exclusive by design
 * (enforced by StudentBillingType enum having separate values)
 */

import type {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

/**
 * Base rates in cents by graduation status and payment frequency
 *
 * NON_GRADUATE (still in school): Higher rates
 * - Monthly: $120/month
 * - Bi-Monthly: $110/month equivalent ($220 every 2 months)
 *
 * GRADUATE (finished education): Lower rates
 * - Monthly: $95/month
 * - Bi-Monthly: $90/month equivalent ($180 every 2 months)
 */
export const BASE_RATES = {
  NON_GRADUATE: {
    MONTHLY: 12000, // $120 in cents
    BI_MONTHLY: 11000, // $110 per month (charged as $220 every 2 months)
  },
  GRADUATE: {
    MONTHLY: 9500, // $95 in cents
    BI_MONTHLY: 9000, // $90 per month (charged as $180 every 2 months)
  },
} as const

/**
 * Scholarship discount in cents ($30)
 */
export const SCHOLARSHIP_DISCOUNT = 3000

/**
 * Calculate Mahad tuition rate based on student parameters
 *
 * @param graduationStatus - NON_GRADUATE or GRADUATE (null defaults to NON_GRADUATE)
 * @param paymentFrequency - MONTHLY or BI_MONTHLY (null defaults to MONTHLY)
 * @param billingType - FULL_TIME, FULL_TIME_SCHOLARSHIP, PART_TIME, or EXEMPT (null returns 0)
 * @returns Rate in cents (per billing cycle). Returns 0 if billing configuration is incomplete.
 *
 * @example
 * // Non-graduate, monthly, full-time = $120/month
 * calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'FULL_TIME') // 12000
 *
 * @example
 * // Graduate, bi-monthly, full-time = $180 every 2 months
 * calculateMahadRate('GRADUATE', 'BI_MONTHLY', 'FULL_TIME') // 18000
 *
 * @example
 * // Exempt student = $0
 * calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'EXEMPT') // 0
 *
 * @example
 * // Missing billing type = $0
 * calculateMahadRate('NON_GRADUATE', 'MONTHLY', null) // 0
 */
export function calculateMahadRate(
  graduationStatus: GraduationStatus | null,
  paymentFrequency: PaymentFrequency | null,
  billingType: StudentBillingType | null
): number {
  // If billing type is not set, return 0 (not billable yet)
  if (!billingType) {
    return 0
  }

  // Exempt students pay nothing and get no subscription
  if (billingType === 'EXEMPT') {
    return 0
  }

  // Default graduation status and frequency if not set
  const effectiveGradStatus = graduationStatus ?? 'NON_GRADUATE'
  const effectiveFrequency = paymentFrequency ?? 'MONTHLY'

  // Get base rate by graduation status and frequency
  const baseRate = BASE_RATES[effectiveGradStatus][effectiveFrequency]
  let rate: number = baseRate

  // Apply billing type modifier
  if (billingType === 'PART_TIME') {
    // Part-time = half rate
    rate = Math.floor(rate / 2)
  } else if (billingType === 'FULL_TIME_SCHOLARSHIP') {
    // Scholarship = $30 off
    rate = rate - SCHOLARSHIP_DISCOUNT
  }

  // For bi-monthly, return the total for 2 months
  if (effectiveFrequency === 'BI_MONTHLY') {
    rate = rate * 2
  }

  return rate
}

/**
 * Get the Stripe billing interval for a payment frequency
 *
 * @param paymentFrequency - MONTHLY or BI_MONTHLY
 * @returns Stripe interval configuration
 */
export function getStripeInterval(paymentFrequency: PaymentFrequency): {
  interval: 'month'
  interval_count: number
} {
  return {
    interval: 'month',
    interval_count: paymentFrequency === 'BI_MONTHLY' ? 2 : 1,
  }
}

/**
 * Check if a student should have a subscription created
 *
 * @param billingType - Student billing type
 * @returns true if student should have subscription, false for EXEMPT students
 */
export function shouldCreateSubscription(
  billingType: StudentBillingType
): boolean {
  return billingType !== 'EXEMPT'
}

/**
 * Format rate for display (converts cents to dollars)
 *
 * @param rateInCents - Rate in cents
 * @returns Formatted string like "$120.00"
 */
export function formatRate(rateInCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(rateInCents / 100)
}

/**
 * Get human-readable description of billing type
 *
 * @param billingType - Student billing type
 * @returns Description string
 */
export function getBillingTypeDescription(
  billingType: StudentBillingType
): string {
  switch (billingType) {
    case 'FULL_TIME':
      return 'Full-time student'
    case 'FULL_TIME_SCHOLARSHIP':
      return 'Full-time with scholarship ($30 discount)'
    case 'PART_TIME':
      return 'Part-time student (50% rate)'
    case 'EXEMPT':
      return 'Exempt from payment (TA, staff, etc.)'
    default:
      return 'Unknown billing type'
  }
}

/**
 * Format rate with frequency for Stripe metadata display
 *
 * @param cents - Rate in cents
 * @param frequency - Payment frequency
 * @returns Formatted string like "$220.00/bi-monthly"
 */
export function formatRateDisplay(
  cents: number,
  frequency: PaymentFrequency
): string {
  const dollars = (cents / 100).toFixed(2)
  const freqLabels: Record<PaymentFrequency, string> = {
    MONTHLY: '/month',
    BI_MONTHLY: '/bi-monthly',
  }
  return `$${dollars}${freqLabels[frequency]}`
}

/**
 * Format graduation status for display
 *
 * @param status - Graduation status
 * @returns Human-readable string
 */
export function formatGraduationStatus(status: GraduationStatus): string {
  return status === 'GRADUATE' ? 'Graduate' : 'Non-Graduate'
}

/**
 * Format billing type for display
 *
 * @param type - Student billing type
 * @returns Human-readable string
 */
export function formatBillingType(type: StudentBillingType): string {
  const labels: Record<StudentBillingType, string> = {
    FULL_TIME: 'Full Time',
    FULL_TIME_SCHOLARSHIP: 'Full Time (Scholarship)',
    PART_TIME: 'Part Time',
    EXEMPT: 'Exempt',
  }
  return labels[type]
}
