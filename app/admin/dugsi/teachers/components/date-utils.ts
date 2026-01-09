import {
  format,
  startOfDay,
  endOfMonth,
  startOfMonth,
  subMonths,
  subDays,
  addDays,
  getDay,
  endOfDay,
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Represents a selectable weekend day option in the UI.
 */
export interface WeekendDayOption {
  value: string
  label: string
  date: Date
  endDate?: Date
}

/**
 * Represents a time period filter option (month or quarter).
 */
export interface FilterOption {
  value: string
  label: string
  start: Date
  end: Date
}

/**
 * Formats a date for check-in display using UTC timezone to prevent
 * off-by-one day errors in local timezones.
 * @param date - The date to format
 * @returns Formatted string like "Sat, Dec 27"
 * @example formatCheckinDate(new Date('2025-12-27T00:00:00Z')) // "Sat, Dec 27"
 */
export function formatCheckinDate(date: Date): string {
  return formatInTimeZone(date, 'UTC', 'EEE, MMM d')
}

/**
 * Formats a date as a time string in 12-hour format.
 * @param date - The date to format
 * @returns Formatted string like "8:30 AM"
 * @example formatCheckinTime(new Date('2025-12-27T08:30:00')) // "8:30 AM"
 */
export function formatCheckinTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

/**
 * Calculates Saturday and Sunday dates for a given number of weeks ago.
 * If called on Friday-Sunday, week 0 is the most recent Saturday/Sunday.
 * If called Monday-Thursday, week 0 is the previous Saturday/Sunday.
 * @param weeksAgo - Number of weeks back to calculate (0 = most recent weekend)
 * @returns Object with start (Saturday) and end (Sunday) dates
 * @example
 * // Called on Friday Jan 9, 2026
 * getWeekendDates(0) // { start: Jan 3, end: Jan 4 }
 */
export function getWeekendDates(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = getDay(now)

  let daysToSaturday: number
  if (dayOfWeek === 6) {
    daysToSaturday = 0
  } else if (dayOfWeek === 0) {
    daysToSaturday = 1
  } else {
    daysToSaturday = dayOfWeek + 1
  }

  const saturdayDate = startOfDay(subDays(now, daysToSaturday + weeksAgo * 7))
  const sundayDate = startOfDay(addDays(saturdayDate, 1))

  return {
    start: saturdayDate,
    end: sundayDate,
  }
}

/**
 * Generates UI options for weekend day selection with context-aware labels.
 * Labels adapt based on current day: "This Weekend/Sat/Sun" on weekends,
 * "Last Weekend/Sat/Sun" on weekdays.
 * @param count - Number of past weekends to include (each weekend generates 2 options)
 * @returns Array of weekend day options for dropdown selection
 * @example
 * // Called on Friday Jan 9, 2026
 * generateWeekendDayOptions(2)
 * // Returns: ["Last Weekend (Jan 3-4)", "Last Sat (Jan 3)", "Last Sun (Jan 4)", ...]
 */
export function generateWeekendDayOptions(count: number): WeekendDayOption[] {
  const options: WeekendDayOption[] = []
  const now = new Date()
  const dayOfWeek = getDay(now)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  const { start: thisSat, end: thisSun } = getWeekendDates(0)

  const weekendLabel = isWeekend ? 'This Weekend' : 'Last Weekend'
  options.push({
    value: 'this-weekend',
    label: `${weekendLabel} (${format(thisSat, 'MMM d')}-${format(thisSun, 'd')})`,
    date: thisSat,
    endDate: thisSun,
  })

  for (let i = 0; i < count; i++) {
    const { start, end } = getWeekendDates(i)

    let satLabel: string
    let sunLabel: string

    if (isWeekend) {
      satLabel =
        i === 0
          ? `This Sat (${format(start, 'MMM d')})`
          : i === 1
            ? `Last Sat (${format(start, 'MMM d')})`
            : `Sat ${format(start, 'MMM d')}`
      sunLabel =
        i === 0
          ? `This Sun (${format(end, 'MMM d')})`
          : i === 1
            ? `Last Sun (${format(end, 'MMM d')})`
            : `Sun ${format(end, 'MMM d')}`
    } else {
      satLabel =
        i === 0
          ? `Last Sat (${format(start, 'MMM d')})`
          : `Sat ${format(start, 'MMM d')}`
      sunLabel =
        i === 0
          ? `Last Sun (${format(end, 'MMM d')})`
          : `Sun ${format(end, 'MMM d')}`
    }

    options.push({ value: `sat-${i}`, label: satLabel, date: start })
    options.push({ value: `sun-${i}`, label: sunLabel, date: end })
  }
  return options
}

/**
 * Gets the start and end dates for the current month.
 * @returns Object with start (first day) and end (last day) of current month
 * @example getThisMonthRange() // { start: Jan 1 00:00, end: Jan 31 23:59 }
 */
export function getThisMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  }
}

/**
 * Gets a date range spanning the last N months including the current month.
 * @param n - Number of months to include
 * @returns Object with start (first day of earliest month) and end (last day of current month)
 * @example
 * // Called in January 2026
 * getLastNMonthsRange(2) // { start: Dec 1 2025, end: Jan 31 2026 }
 */
export function getLastNMonthsRange(n: number): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(subMonths(now, n - 1)),
    end: endOfMonth(now),
  }
}

/**
 * Calculates the start and end dates for a specific quarter.
 * @param year - The year (e.g., 2026)
 * @param quarter - The quarter number (1-4)
 * @returns Object with start and end dates for the quarter
 * @example getQuarterRange(2026, 1) // { start: Jan 1 00:00, end: Mar 31 23:59 }
 */
export function getQuarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4
): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = endOfMonth(new Date(year, startMonth + 2, 1))
  return { start: startOfDay(start), end: endOfDay(end) }
}

/**
 * Gets available quarters for selection based on current date.
 * Returns current quarter (if more than 1 month complete), remaining quarters from
 * current year, and all quarters from previous year.
 * @returns Array of year/quarter objects ordered from most recent
 * @example
 * // Called in March 2026 (Q1, month 2)
 * getAvailableQuarters()
 * // Returns: [{ year: 2026, quarter: 1 }, { year: 2025, quarter: 4 }, ...]
 */
export function getAvailableQuarters(): {
  year: number
  quarter: 1 | 2 | 3 | 4
}[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3) + 1

  const quarters: { year: number; quarter: 1 | 2 | 3 | 4 }[] = []

  const monthInQuarter = currentMonth % 3
  if (monthInQuarter >= 1) {
    quarters.push({
      year: currentYear,
      quarter: currentQuarter as 1 | 2 | 3 | 4,
    })
  }

  for (let q = currentQuarter - 1; q >= 1; q--) {
    quarters.push({ year: currentYear, quarter: q as 1 | 2 | 3 | 4 })
  }

  for (let q = 4; q >= 1; q--) {
    quarters.push({ year: currentYear - 1, quarter: q as 1 | 2 | 3 | 4 })
  }

  return quarters
}

/**
 * Generates predefined filter options for history views.
 * Returns month options (This Month, Last 2 Months) and available quarter options.
 * @returns Object with arrays of month and quarter filter options
 * @example
 * generateHistoryFilterOptions()
 * // {
 * //   months: [{ value: 'this-month', label: 'This Month', start: ..., end: ... }],
 * //   quarters: [{ value: 'q1-2026', label: 'Q1 2026', start: ..., end: ... }]
 * // }
 */
export function generateHistoryFilterOptions(): {
  months: FilterOption[]
  quarters: FilterOption[]
} {
  const months: FilterOption[] = [
    {
      value: 'this-month',
      label: 'This Month',
      ...getThisMonthRange(),
    },
    {
      value: 'last-2-months',
      label: 'Last 2 Months',
      ...getLastNMonthsRange(2),
    },
  ]

  const availableQuarters = getAvailableQuarters()
  const quarters: FilterOption[] = availableQuarters.map((q) => ({
    value: `q${q.quarter}-${q.year}`,
    label: `Q${q.quarter} ${q.year}`,
    ...getQuarterRange(q.year, q.quarter),
  }))

  return { months, quarters }
}
