/**
 * Billing Date Utilities
 *
 * Shared utilities for billing start date selection in payment link dialogs.
 * Used by both Mahad and Dugsi payment flows.
 */

/**
 * Maximum day of month allowed for billing start.
 * Limited to 15th to ensure billing always falls within a calendar month
 * and to align with typical business billing cycles.
 */
export const MAX_BILLING_START_DAY = 15

/**
 * Format a day number as an ordinal string (1st, 2nd, 3rd, 4th, etc.)
 */
export function formatOrdinal(day: number): string {
  if (day === 1 || day === 21 || day === 31) return `${day}st`
  if (day === 2 || day === 22) return `${day}nd`
  if (day === 3 || day === 23) return `${day}rd`
  return `${day}th`
}

/**
 * Calculate the next occurrence of a given day of month.
 * If the day has already passed this month, returns next month's date.
 *
 * @param day - Day of month (1-31)
 * @returns Date object for the next occurrence
 */
export function getNextBillingDate(day: number): Date {
  const now = new Date()
  let target = new Date(now.getFullYear(), now.getMonth(), day)

  if (target <= now) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, day)
  }

  return target
}

/**
 * Format a billing date for display (e.g., "January 4, 2026")
 */
export function formatBillingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Validate that a billing cycle anchor timestamp is valid for Stripe.
 * - Must be in the future
 * - Must be within 1 year
 *
 * @param timestamp - Unix timestamp in seconds
 * @throws Error if validation fails
 */
export function validateBillingCycleAnchor(timestamp: number): void {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const oneYearFromNow = nowSeconds + 365 * 24 * 60 * 60

  if (timestamp <= nowSeconds) {
    throw new Error('Billing start date must be in the future')
  }

  if (timestamp > oneYearFromNow) {
    throw new Error('Billing start date must be within 1 year')
  }
}

/**
 * Generate an array of billing day options for Select component
 */
export function getBillingDayOptions(): Array<{
  value: string
  label: string
}> {
  return Array.from({ length: MAX_BILLING_START_DAY }, (_, i) => ({
    value: (i + 1).toString(),
    label: `${formatOrdinal(i + 1)} of the month`,
  }))
}
