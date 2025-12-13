'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ClassReportCardProps {
  stats: {
    classId: string
    className: string
    totalSessions: number
    averageAttendanceRate: number
    averageLessonCompletionRate: number
  }
}

export function ClassReportCard({ stats }: ClassReportCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{stats.className}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sessions</span>
          <span className="font-medium">{stats.totalSessions}</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-medium">{stats.averageAttendanceRate}%</span>
          </div>
          <ProgressBar value={stats.averageAttendanceRate} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Lessons</span>
            <span className="font-medium">
              {stats.averageLessonCompletionRate}%
            </span>
          </div>
          <ProgressBar value={stats.averageLessonCompletionRate} />
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressBar({ value }: { value: number }) {
  const colorClass =
    value >= 80 ? 'bg-green-600' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn('h-full transition-all', colorClass)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
