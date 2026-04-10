import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { getAttendanceGrid, listSchoolClosures } from '@/lib/db/queries/teacher-attendance'

import { AttendanceGrid } from './components/attendance-grid'

export const dynamic = 'force-dynamic'

// Returns the last N weekend dates (Sat + Sun) in descending order
function getRecentWeekendDates(weeksBack: number): string[] {
  const today = new Date()
  const todayStr = formatInTimeZone(today, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const anchor = new Date(`${todayStr}T12:00:00Z`)
  const dates: string[] = []

  const cursor = new Date(anchor)
  let daysBack = 0

  while (dates.length < weeksBack * 2 && daysBack < weeksBack * 7 + 14) {
    const day = cursor.getUTCDay()
    if (day === 0 || day === 6) {
      const y = cursor.getUTCFullYear()
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const d = String(cursor.getUTCDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    daysBack++
  }

  return dates // descending: most recent first
}

export default async function TeacherAttendancePage() {
  const WEEKS_BACK = 8
  const weekendDates = getRecentWeekendDates(WEEKS_BACK)
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - WEEKS_BACK * 7)
  const [records, closures] = await Promise.all([
    getAttendanceGrid(from, today),
    listSchoolClosures(from, today),
  ])

  const closureSet = new Set(
    closures.map((c) => formatInTimeZone(c.date, 'UTC', 'yyyy-MM-dd'))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last {WEEKS_BACK} weekends — click any cell to override status
        </p>
      </div>

      {closureSet.size > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          School closed:{' '}
          {Array.from(closureSet)
            .sort()
            .reverse()
            .slice(0, 3)
            .join(', ')}
          {closureSet.size > 3 && ` +${closureSet.size - 3} more`}
        </div>
      )}

      <AttendanceGrid records={records} weekendDates={weekendDates} />
    </div>
  )
}
