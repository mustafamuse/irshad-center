export function getNextWeekendDate(): string {
  const today = new Date()
  const day = today.getDay()
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
  const day = date.getDay()
  return day === 0 || day === 6
}
