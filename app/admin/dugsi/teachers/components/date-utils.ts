import {
  format,
  startOfDay,
  endOfDay,
  endOfMonth,
  startOfMonth,
  subMonths,
  subDays,
  addDays,
  getDay,
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export interface WeekendDayOption {
  value: string
  label: string
  date: Date
  endDate?: Date
}

export interface FilterOption {
  value: string
  label: string
  start: Date
  end: Date
}

export function formatCheckinDate(date: Date): string {
  return formatInTimeZone(date, 'UTC', 'EEE, MMM d')
}

export function formatCheckinTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

export function formatFullDate(date: Date): string {
  return format(new Date(date), 'EEEE, MMMM d, yyyy')
}

function getDaysToSaturday(dayOfWeek: number): number {
  if (dayOfWeek === 6) return 0
  if (dayOfWeek === 0) return 1
  return dayOfWeek + 1
}

export function getWeekendDates(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = getDay(now)
  const daysToSaturday = getDaysToSaturday(dayOfWeek)

  const saturdayDate = startOfDay(subDays(now, daysToSaturday + weeksAgo * 7))
  const sundayDate = startOfDay(addDays(saturdayDate, 1))

  return {
    start: saturdayDate,
    end: sundayDate,
  }
}

function getDayLabel(
  day: 'Sat' | 'Sun',
  weeksAgo: number,
  isCurrentlyWeekend: boolean,
  formattedDate: string
): string {
  if (weeksAgo === 0) {
    const prefix = isCurrentlyWeekend ? 'This' : 'Last'
    return `${prefix} ${day} (${formattedDate})`
  }
  if (weeksAgo === 1 && isCurrentlyWeekend) {
    return `Last ${day} (${formattedDate})`
  }
  return `${day} ${formattedDate}`
}

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

    const satLabel = getDayLabel('Sat', i, isWeekend, format(start, 'MMM d'))
    const sunLabel = getDayLabel('Sun', i, isWeekend, format(end, 'MMM d'))

    options.push({ value: `sat-${i}`, label: satLabel, date: start })
    options.push({ value: `sun-${i}`, label: sunLabel, date: end })
  }
  return options
}

export function getThisMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  }
}

export function getLastNMonthsRange(n: number): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(subMonths(now, n - 1)),
    end: endOfMonth(now),
  }
}

export function getQuarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4
): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = endOfMonth(new Date(year, startMonth + 2, 1))
  return { start: startOfDay(start), end: endOfDay(end) }
}

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
