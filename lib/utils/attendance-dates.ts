import { addDays, endOfDay, isPast } from 'date-fns'

export function isSessionEffectivelyClosed(
  sessionDate: Date,
  isClosed: boolean
): boolean {
  const day = sessionDate.getUTCDay()
  const sunday = day === 6 ? addDays(sessionDate, 1) : sessionDate
  return isClosed || isPast(endOfDay(sunday))
}

export function getNextWeekendDate(): string {
  const today = new Date()
  const day = today.getUTCDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  const nextSaturday = new Date(today)
  nextSaturday.setDate(today.getDate() + daysUntilSaturday)
  return nextSaturday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function isWeekendDay(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}
