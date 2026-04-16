/**
 * Shared date-of-birth helpers used by both the Month/Day/Year input component
 * and the registration schemas for age validation.
 *
 * Extracted so the two consumers agree on parsing, valid-date construction,
 * and a leap-year-safe age calculation (replaces the old ~365-day approximation
 * that could be off-by-one around birthdays).
 */

export interface DateParts {
  month: string
  day: string
  year: string
}

/**
 * Break a `Date` into month/day/year string parts for split-input rendering.
 * Returns empty strings when the value is absent or not a valid `Date`.
 */
export function parseDateParts(value: unknown): DateParts {
  if (!value || !(value instanceof Date) || Number.isNaN(value.getTime())) {
    return { month: '', day: '', year: '' }
  }
  return {
    month: String(value.getMonth() + 1),
    day: String(value.getDate()),
    year: String(value.getFullYear()),
  }
}

/**
 * Build a `Date` from month/day/year string parts. Returns `undefined` when
 * any part is missing, non-numeric, out of range, or combines to an invalid
 * calendar date (e.g. Feb 30).
 */
export function tryBuildDate(
  month: string,
  day: string,
  year: string
): Date | undefined {
  const m = Number.parseInt(month, 10)
  const d = Number.parseInt(day, 10)
  const y = Number.parseInt(year, 10)
  if (
    !month.trim() ||
    !day.trim() ||
    !year.trim() ||
    [m, d, y].some((n) => Number.isNaN(n))
  ) {
    return undefined
  }
  if (year.trim().length !== 4) return undefined
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000) return undefined
  const dt = new Date(y, m - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return undefined
  }
  return dt
}

/**
 * Calculate age in whole years between two dates using calendar arithmetic
 * (leap-safe). Replaces the previous `Math.floor(ms / 31536000000)` trick
 * that could drift by a day around birthdays across many-leap-year spans.
 */
export function getAgeInYears(
  dateOfBirth: Date,
  now: Date = new Date()
): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  const dayDiff = now.getDate() - dateOfBirth.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }
  return age
}
