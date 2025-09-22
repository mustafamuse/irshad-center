'use client'

import { Card } from '@/components/ui/card'

interface AttendanceStatsProps {
  stats: {
    present: number
    absent: number
    late: number
    excused: number
    total: number
    marked: number
  }
}

export function AttendanceStats({ stats }: AttendanceStatsProps) {
  const statItems = [
    { label: 'Present', value: stats.present },
    { label: 'Absent', value: stats.absent },
    { label: 'Late', value: stats.late },
    { label: 'Excused', value: stats.excused },
  ]

  return (
    <Card className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="text-sm">
        <p className="mb-2 font-medium">Attendance Summary</p>
        <div className="grid grid-cols-2 gap-4">
          {statItems.map(({ label, value }) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>
              {stats.marked} of {stats.total} marked
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{
                width: `${(stats.marked / stats.total) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
