/**
 * Billing Date Utilities
 *
 * Shared utilities for billing start date selection in payment link dialogs.
 * Used by both Mahad and Dugsi payment flows.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz'

/**
 * Maximum day of month allowed for billing start.
 * Limited to 15th to ensure billing always falls within a calendar month
 * and to align with typical business billing cycles.
 */
export const MAX_BILLING_START_DAY = 15

/**
 * Maximum days in the future for billing_cycle_anchor.
 * Stripe requires anchor to be within ~1 year.
 */
export const MAX_BILLING_ANCHOR_DAYS = 365

/**
 * Default timezone for billing calculations.
 * Minneapolis-based organization uses Central Time.
 */
export const BILLING_TIMEZONE = 'America/Chicago'

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
 * Uses explicit timezone (America/Chicago) to avoid midnight boundary issues.
 * Returns a UTC Date that represents midnight on the target day in Central Time.
 *
 * The conversion works as follows:
 * 1. Get current time and convert to America/Chicago timezone
 * 2. Calculate target date (this month or next) in local terms
 * 3. Use fromZonedTime to convert "midnight in Chicago" to UTC
 *
 * @param day - Day of month (1-15)
 * @param timezone - Optional timezone override (defaults to America/Chicago)
 * @returns Date object for the next occurrence (in UTC)
 * @throws Error if day is invalid
 */
export function getNextBillingDate(
  day: number,
  timezone: string = BILLING_TIMEZONE
): Date {
  if (!Number.isInteger(day) || day < 1 || day > MAX_BILLING_START_DAY) {
    throw new Error(
      `Invalid billing day: ${day}. Must be integer 1-${MAX_BILLING_START_DAY}`
    )
  }

  const now = new Date()
  const nowInTz = toZonedTime(now, timezone)

  // Extract year, month from the timezone-adjusted "now"
  const year = nowInTz.getFullYear()
  const month = nowInTz.getMonth()
  const currentDay = nowInTz.getDate()

  // Determine target month: if day has passed, use next month
  let targetYear = year
  let targetMonth = month
  if (day <= currentDay) {
    targetMonth = month + 1
    if (targetMonth > 11) {
      targetMonth = 0
      targetYear = year + 1
    }
  }

  // Create a date string representing midnight on target day in the timezone
  // Format: "YYYY-MM-DD 00:00:00" which fromZonedTime interprets as that time in the given timezone
  const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`

  // Convert "midnight in Chicago" to UTC
  return fromZonedTime(dateStr, timezone)
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
 * - Must be within MAX_BILLING_ANCHOR_DAYS
 *
 * @param timestamp - Unix timestamp in seconds
 * @throws Error if validation fails
 */
export function validateBillingCycleAnchor(timestamp: number): void {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const maxFutureSeconds = nowSeconds + MAX_BILLING_ANCHOR_DAYS * 24 * 60 * 60

  if (timestamp <= nowSeconds) {
    throw new Error('Billing start date must be in the future')
  }

  if (timestamp > maxFutureSeconds) {
    throw new Error('Billing start date must be within 1 year')
  }
}

/**
 * Parse and validate a billing day string from form input.
 * Returns the parsed day number or null if invalid.
 *
 * @param value - String value from form input
 * @returns Parsed day number (1-15) or null if invalid/empty
 */
export function parseBillingDay(value: string | undefined): number | null {
  if (!value) return null

  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 1 || parsed > MAX_BILLING_START_DAY) {
    return null
  }

  return parsed
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
