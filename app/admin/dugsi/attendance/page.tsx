import { Suspense } from 'react'

import { Card } from '@/components/ui/card'

import { AttendanceManagement } from './components/attendance-management'
import { AttendanceStats } from './components/attendance-stats'
import {
  AttendanceStatsCardSkeleton,
  SessionsTableSkeleton as SessionsTableSkeletonComponent,
  TodaySessionsSkeleton,
} from './components/skeletons'
import { TodaySessions } from './components/today-sessions'

interface Props {
  searchParams: Promise<{
    page?: string
    fromDate?: string
    toDate?: string
    classId?: string
    teacherId?: string
  }>
}

export default async function AttendancePage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams
  return (
    <div className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-2 sm:gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Weekend Attendance
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage and track student attendance for weekend study sessions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Suspense fallback={<StatsCardSkeleton />}>
          <AttendanceStats />
        </Suspense>
      </div>

      <Suspense fallback={<TodaySessionsSkeleton />}>
        <TodaySessions />
      </Suspense>

      <Card className="p-4 sm:p-6">
        <Suspense fallback={<SessionsTableSkeletonComponent />}>
          <AttendanceManagement searchParams={resolvedSearchParams} />
        </Suspense>
      </Card>
    </div>
  )
}

function StatsCardSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <AttendanceStatsCardSkeleton key={i} />
      ))}
    </>
  )
}
