import { Shift } from '@prisma/client'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getTeacherShiftStats,
  getTeacherMonthlyTrendWithShifts,
} from '@/lib/db/queries/dugsi-attendance'

const SHIFT_LABEL: Record<Shift, string> = {
  MORNING: 'AM',
  AFTERNOON: 'PM',
}

interface Props {
  teacherId: string
}

export async function TeacherStats({ teacherId }: Props) {
  const [shiftStats, trendData] = await Promise.all([
    getTeacherShiftStats(teacherId),
    getTeacherMonthlyTrendWithShifts(teacherId),
  ])

  const hasMultipleShifts = shiftStats.length > 1

  const totalSessions = shiftStats.reduce((s, x) => s + x.sessions, 0)
  const totalStudents = shiftStats.reduce((s, x) => s + x.students, 0)

  const weightedSum = shiftStats.reduce((s, x) => s + x.rate * x.students, 0)
  const overallRate =
    totalStudents > 0 ? Math.round((weightedSum / totalStudents) * 10) / 10 : 0

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSessions}</div>
          {hasMultipleShifts ? (
            <ShiftBreakdown
              items={shiftStats.map((s) => ({
                shift: s.shift,
                value: String(s.sessions),
              }))}
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStudents}</div>
          {hasMultipleShifts ? (
            <ShiftBreakdown
              items={shiftStats.map((s) => ({
                shift: s.shift,
                value: String(s.students),
              }))}
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Attendance Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overallRate}%</div>
          {hasMultipleShifts ? (
            <ShiftBreakdown
              items={shiftStats.map((s) => ({
                shift: s.shift,
                value: `${s.rate}%`,
              }))}
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Monthly Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.overall === null ? (
            <div className="text-2xl font-bold text-muted-foreground">N/A</div>
          ) : (
            <TrendValue diff={trendData.overall.diff} size="lg" />
          )}
          {hasMultipleShifts && trendData.byShift.length > 1 ? (
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              {trendData.byShift.map((s) => (
                <span key={s.shift} className="flex items-center gap-0.5">
                  {SHIFT_LABEL[s.shift]}{' '}
                  {s.diff === null ? (
                    'N/A'
                  ) : (
                    <TrendValue diff={s.diff} size="sm" />
                  )}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

function ShiftBreakdown({
  items,
}: {
  items: { shift: Shift; value: string }[]
}) {
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={item.shift}>
          {i > 0 && <span className="mx-1.5">&middot;</span>}
          {SHIFT_LABEL[item.shift]} {item.value}
        </span>
      ))}
    </div>
  )
}

function TrendValue({ diff, size }: { diff: number; size: 'lg' | 'sm' }) {
  const isPositive = diff >= 0
  const color = isPositive ? 'text-green-600' : 'text-red-600'
  const Icon = isPositive ? ArrowUp : ArrowDown

  if (size === 'lg') {
    return (
      <div className={`flex items-center gap-1 text-2xl font-bold ${color}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
        {isPositive ? '+' : ''}
        {diff}%
      </div>
    )
  }

  return (
    <span className={`inline-flex items-center gap-0.5 ${color}`}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {isPositive ? '+' : ''}
      {diff}%
    </span>
  )
}
