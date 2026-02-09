import type { SubscriptionStatus } from '@prisma/client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { STATUS_COLORS, STATUS_LABELS } from '../../_constants/status-display'
import type {
  EnrollmentDistribution as EnrollmentDistributionData,
  ProgramHealthStats,
} from '../../_types/insights'

interface EnrollmentDistributionProps {
  enrollment: EnrollmentDistributionData
  health: ProgramHealthStats
}

function ShiftRatioBar({
  morning,
  afternoon,
}: {
  morning: number
  afternoon: number
}) {
  const total = morning + afternoon
  const morningPct = total > 0 ? (morning / total) * 100 : 50

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold tabular-nums">{morning}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">Morning</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums">{afternoon}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">
            Afternoon
          </span>
        </div>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className="rounded-l-full transition-all"
          style={{
            width: `${morningPct}%`,
            backgroundColor: '#deb43e',
          }}
        />
        <div
          className="rounded-r-full transition-all"
          style={{
            width: `${100 - morningPct}%`,
            backgroundColor: '#0ea5a0',
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{Math.round(morningPct)}%</span>
        <span>{Math.round(100 - morningPct)}%</span>
      </div>
    </div>
  )
}

function FamilyStatusBar({
  data,
}: {
  data: Record<SubscriptionStatus | 'none', number>
}) {
  const entries = (
    Object.entries(data) as [SubscriptionStatus | 'none', number][]
  ).filter(([, count]) => count > 0)

  const total = entries.reduce((sum, [, c]) => sum + c, 0)
  if (total === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        {entries.map(([status, count], i) => {
          const pct = (count / total) * 100
          const isFirst = i === 0
          const isLast = i === entries.length - 1
          return (
            <div
              key={status}
              className={cn(
                'transition-all',
                isFirst && 'rounded-l-full',
                isLast && 'rounded-r-full'
              )}
              style={{
                width: `${pct}%`,
                backgroundColor: STATUS_COLORS[status],
                minWidth: count > 0 ? 4 : 0,
              }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            <span className="text-muted-foreground">
              {STATUS_LABELS[status]}
            </span>
            <span className="font-medium tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EnrollmentDistribution({
  enrollment,
  health,
}: EnrollmentDistributionProps) {
  const totalStudents =
    enrollment.assignedToClass + enrollment.unassignedToClass
  const assignedPct =
    totalStudents > 0
      ? Math.round((enrollment.assignedToClass / totalStudents) * 100)
      : 0

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Enrollment & Operations</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Shift & Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ShiftRatioBar
              morning={enrollment.morningStudents}
              afternoon={enrollment.afternoonStudents}
            />
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Assigned to class
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tabular-nums text-green-600">
                      {enrollment.assignedToClass}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({assignedPct}%)
                    </span>
                  </div>
                </div>
                {enrollment.unassignedToClass > 0 && (
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">
                      Unassigned
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold tabular-nums text-amber-600">
                        {enrollment.unassignedToClass}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-sm font-medium">
                Family Status
              </CardTitle>
              <span className="text-2xl font-bold tabular-nums">
                {health.totalFamilies}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <FamilyStatusBar data={health.familyStatusBreakdown} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
