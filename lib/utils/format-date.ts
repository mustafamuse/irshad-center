import { format } from 'date-fns'

/**
 * Formats a YYYY-MM-DD date string as a short weekend label: "Sat Jan 17"
 * Uses a UTC noon anchor (T12:00:00Z) so the day-of-week is correct in all
 * browser timezones, not just UTC or US timezones.
 */
export function formatWeekendDate(dateStr: string): string {
  return format(new Date(`${dateStr}T12:00:00Z`), 'EEE MMM d')
}
