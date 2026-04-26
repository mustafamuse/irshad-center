export interface DateParts {
  month: string
  day: string
  year: string
}

export function parseDateParts(value: unknown): DateParts {
  if (!value || !(value instanceof Date) || Number.isNaN(value.getTime())) {
    return { month: '', day: '', year: '' }
  }

  return {
    month: String(value.getMonth() + 1).padStart(2, '0'),
    day: String(value.getDate()).padStart(2, '0'),
    year: String(value.getFullYear()),
  }
}

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
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return undefined
  }

  return dt
}

export function getAgeInYears(date: Date, now = new Date()): number {
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }

  return age
}
