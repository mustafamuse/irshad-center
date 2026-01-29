import { Suspense } from 'react'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getTeacherClassIds,
  getStudentProfile,
  getStudentAttendanceStats,
  getStudentMonthlyComparison,
  getStudentWeeklyTrend,
  getStudentAttendanceRecords,
} from '@/lib/db/queries/teacher-students'
import {
  computeCurrentStreak,
  groupRecordsByWeekend,
} from '@/lib/mappers/teacher-student-mapper'

import { LazyAttendanceTrend } from './components/lazy-attendance-trend'
import { SessionHistoryList } from './components/session-history-list'

interface Props {
  params: Promise<{ profileId: string }>
}

async function StatsCards({ profileId }: { profileId: string }) {
  const [rawStats, monthlyComparison] = await Promise.all([
    getStudentAttendanceStats(profileId),
    getStudentMonthlyComparison(profileId),
  ])
  const currentStreak = computeCurrentStreak(rawStats.recentRecords)
  const stats = { ...rawStats, currentStreak }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Attendance Rate</p>
        <p className="text-xl font-bold tabular-nums">
          {stats.attendanceRate}%
        </p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Current Streak</p>
        <p className="text-xl font-bold tabular-nums">{stats.currentStreak}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">vs Last Month</p>
        {monthlyComparison ? (
          <p
            className={`flex items-center gap-1 text-xl font-bold ${monthlyComparison.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {monthlyComparison.diff >= 0 ? (
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            )}
            {monthlyComparison.diff >= 0 ? '+' : ''}
            {monthlyComparison.diff}%
          </p>
        ) : (
          <p className="text-xl font-bold tabular-nums text-muted-foreground">
            N/A
          </p>
        )}
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Total Sessions</p>
        <p className="text-xl font-bold tabular-nums">{stats.totalSessions}</p>
      </Card>
    </div>
  )
}

async function TrendCard({ profileId }: { profileId: string }) {
  const rawTrend = await getStudentWeeklyTrend(profileId)
  const trend = groupRecordsByWeekend(rawTrend)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Weekend Trend</h2>
      <LazyAttendanceTrend data={trend} />
    </Card>
  )
}

async function HistoryCard({ profileId }: { profileId: string }) {
  const history = await getStudentAttendanceRecords(profileId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Session History</h2>
      <SessionHistoryList
        initialData={history.data}
        profileId={profileId}
        initialHasMore={history.hasMore}
      />
    </Card>
  )
}

function CardSkeleton({ height = 'h-32' }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-lg border bg-card`} />
}

export default async function StudentDetailPage({ params }: Props) {
  const { profileId } = await params
  const teacherId = await getAuthenticatedTeacherId()
  const [student, classIds] = await Promise.all([
    getStudentProfile(profileId),
    getTeacherClassIds(teacherId),
  ])

  if (!student || !classIds.includes(student.classId)) {
    redirect('/teacher/attendance')
  }

  return (
    <div className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/teacher/attendance"
          aria-label="Back to attendance"
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{student.name}</h1>
          <p className="text-sm text-muted-foreground">
            {student.className} &middot; {student.shift}
          </p>
        </div>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <StatsCards profileId={profileId} />
      </Suspense>

      <Suspense fallback={<CardSkeleton height="h-64" />}>
        <TrendCard profileId={profileId} />
      </Suspense>

      <Suspense fallback={<CardSkeleton height="h-48" />}>
        <HistoryCard profileId={profileId} />
      </Suspense>
    </div>
  )
}
