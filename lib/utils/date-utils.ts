/**
 * Returns all weekend dates (Saturday + Sunday) between `from` and `to`,
 * inclusive, in ascending order as YYYY-MM-DD strings.
 *
 * Both bounds should be UTC noon anchors (T12:00:00Z) to avoid timezone
 * edge cases when deriving day-of-week with getUTCDay().
 */
export function getWeekendDatesBetween(from: Date, to: Date): string[] {
  const dates: string[] = []
  const cursor = new Date(from)

  while (cursor <= to) {
    const day = cursor.getUTCDay()
    if (day === 0 || day === 6) {
      const y = cursor.getUTCFullYear()
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const d = String(cursor.getUTCDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}
