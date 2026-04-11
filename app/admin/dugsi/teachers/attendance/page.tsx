import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import {
  getAttendanceGrid,
  getActiveDugsiTeacherShifts,
  listSchoolClosures,
} from '@/lib/db/queries/teacher-attendance'
import { getWeekendDatesBetween } from '@/lib/utils/date-utils'

import { AttendanceGrid } from './components/attendance-grid'

export const dynamic = 'force-dynamic'

// Returns the last N weekend dates (Sat + Sun) in descending order.
function getRecentWeekendDates(weeksBack: number): string[] {
  const todayStr = formatInTimeZone(new Date(), SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const to = new Date(`${todayStr}T12:00:00Z`)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - weeksBack * 7)
  return getWeekendDatesBetween(from, to).reverse()
}

export default async function TeacherAttendancePage() {
  const WEEKS_BACK = 8
  const weekendDates = getRecentWeekendDates(WEEKS_BACK)
  // Derive bounds from weekendDates (already timezone-correct) rather than raw UTC new Date().
  // Near UTC midnight, raw Date diverges from SCHOOL_TIMEZONE by a calendar day, which
  // would produce column headers outside the fetched record window.
  const from = new Date(`${weekendDates[weekendDates.length - 1]}T00:00:00Z`)
  // Exclusive upper bound: start of the day *after* the last weekend date.
  // Using `lt` (not `lte`) in queries avoids the implicit DATE→TIMESTAMP cast ambiguity
  // of T23:59:59Z and is consistent with the `from` boundary style.
  const to = new Date(`${weekendDates[0]}T00:00:00Z`)
  to.setUTCDate(to.getUTCDate() + 1)
  const [records, closures, activeTeachers] = await Promise.all([
    getAttendanceGrid(from, to),
    listSchoolClosures(from, to),
    // Fetch full active roster so teachers with no records in the window still get a grid row.
    getActiveDugsiTeacherShifts(),
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
          {Array.from(closureSet).sort().reverse().slice(0, 3).join(', ')}
          {closureSet.size > 3 && ` +${closureSet.size - 3} more`}
        </div>
      )}

      <AttendanceGrid
        records={records}
        weekendDates={weekendDates}
        closureDates={closureSet}
        allTeachers={activeTeachers}
      />
    </div>
  )
}
