import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { VisxRegistrationTrendChart } from './charts/visx-registration-trend-chart'
import type { RegistrationTrendItem } from '../../_types/insights'

interface RegistrationTrendProps {
  data: RegistrationTrendItem[]
}

export function RegistrationTrend({ data }: RegistrationTrendProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Registration Trend</h3>
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            New Registrations (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.some((d) => d.studentCount > 0) ? (
            <VisxRegistrationTrendChart data={data} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No registrations in the last 12 months
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
