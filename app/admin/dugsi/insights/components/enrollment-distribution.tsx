import { BookOpen, UserX } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { FamilyStatusPieChart } from './charts/family-status-pie-chart'
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
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Enrollment Distribution</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Shift Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShiftDistributionChart
              morning={enrollment.morningStudents}
              afternoon={enrollment.afternoonStudents}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Family Status</CardTitle>
          </CardHeader>
          <CardContent>
            <FamilyStatusPieChart data={health.familyStatusBreakdown} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-1 bg-green-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned to Class
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <BookOpen aria-hidden="true" className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums tracking-tight text-green-600">
              {enrollment.assignedToClass}
            </div>
            <p className="text-xs text-muted-foreground">
              {enrollment.assignedToClass + enrollment.unassignedToClass > 0
                ? Math.round(
                    (enrollment.assignedToClass /
                      (enrollment.assignedToClass +
                        enrollment.unassignedToClass)) *
                      100
                  )
                : 0}
              % of active students
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'overflow-hidden border-0 shadow-md',
            enrollment.unassignedToClass > 0 && 'ring-2 ring-amber-200'
          )}
        >
          <div
            className={cn(
              'h-1',
              enrollment.unassignedToClass > 0 ? 'bg-amber-500' : 'bg-gray-200'
            )}
          />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                enrollment.unassignedToClass > 0
                  ? 'bg-amber-100'
                  : 'bg-gray-100'
              )}
            >
              <UserX
                aria-hidden="true"
                className={cn(
                  'h-4 w-4',
                  enrollment.unassignedToClass > 0
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                )}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold tabular-nums tracking-tight',
                enrollment.unassignedToClass > 0 && 'text-amber-600'
              )}
            >
              {enrollment.unassignedToClass}
            </div>
            <p className="text-xs text-muted-foreground">
              Need class assignment
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
