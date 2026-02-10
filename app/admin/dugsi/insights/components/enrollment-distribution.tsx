import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { FamilyStatusChart } from './charts/family-status-chart'
import { ShiftDistributionChart } from './charts/shift-distribution-chart'
import type {
  EnrollmentDistribution as EnrollmentDistributionData,
  ProgramHealthStats,
} from '../../_types/insights'

interface EnrollmentDistributionProps {
  enrollment: EnrollmentDistributionData
  health: ProgramHealthStats
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
              Shift Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ShiftDistributionChart
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
            <CardTitle className="text-sm font-medium">Family Status</CardTitle>
          </CardHeader>
          <CardContent>
            <FamilyStatusChart
              data={health.familyStatusBreakdown}
              totalFamilies={health.totalFamilies}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
