'use client'

import dynamic from 'next/dynamic'

import type { WeekendTrendPoint } from '@/lib/mappers/teacher-student-mapper'

const AttendanceTrend = dynamic(
  () => import('./attendance-trend').then((mod) => mod.AttendanceTrend),
  { ssr: false, loading: () => <div className="h-[200px] w-full" /> }
)

export function LazyAttendanceTrend({ data }: { data: WeekendTrendPoint[] }) {
  return <AttendanceTrend data={data} />
}
