import { DugsiAttendanceStatus, Shift } from '@prisma/client'

import { getLocalDay, getLocalDateString } from '@/lib/utils/attendance-dates'

export interface StudentDetailDTO {
  profileId: string
  name: string
  className: string
  shift: Shift
}

export interface StudentAttendanceStatsDTO {
  totalSessions: number
  attendanceRate: number
  currentStreak: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
}

export interface WeekendTrendPoint {
  weekLabel: string
  rate: number
  total: number
}

export interface SessionHistoryItem {
  sessionId: string
  date: string
  status: DugsiAttendanceStatus
  lessonCompleted: boolean
  surahName: string | null
  ayatFrom: number | null
  ayatTo: number | null
}

export function computeCurrentStreak(
  records: { status: DugsiAttendanceStatus; date: Date }[]
): number {
  let streak = 0
  for (const r of records) {
    if (
      r.status === DugsiAttendanceStatus.PRESENT ||
      r.status === DugsiAttendanceStatus.LATE
    ) {
      streak++
    } else if (r.status === DugsiAttendanceStatus.EXCUSED) {
      continue
    } else {
      break
    }
  }
  return streak
}

export function groupRecordsByWeekend(
  records: { date: Date; status: DugsiAttendanceStatus }[]
): WeekendTrendPoint[] {
  const weekendMap = new Map<
    string,
    { present: number; total: number; saturday: Date }
  >()

  for (const r of records) {
    const d = new Date(r.date)
    const day = getLocalDay(d)
    if (day !== 0 && day !== 6) continue
    const saturday = new Date(d)
    if (day === 0) {
      saturday.setDate(d.getDate() - 1)
    }
    const key = getLocalDateString(saturday)

    const entry = weekendMap.get(key) ?? { present: 0, total: 0, saturday }
    entry.total++
    if (
      r.status === DugsiAttendanceStatus.PRESENT ||
      r.status === DugsiAttendanceStatus.LATE
    ) {
      entry.present++
    }
    weekendMap.set(key, entry)
  }

  return Array.from(weekendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      weekLabel: v.saturday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
      total: v.total,
    }))
}
