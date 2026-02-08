import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { RevenueTierBarChart } from './charts/revenue-tier-bar-chart'
import type { RevenueStats } from '../../_types/insights'
import { formatCentsWhole } from '../../_utils/format'

interface RevenueAnalyticsProps {
  data: RevenueStats
}

function getVarianceStyle(variance: number): {
  barColor: string
  bgColor: string
  iconColor: string
} {
  if (variance === 0) {
    return {
      barColor: 'bg-gray-200',
      bgColor: 'bg-gray-100',
      iconColor: 'text-muted-foreground',
    }
  }
  if (variance > 0) {
    return {
      barColor: 'bg-green-500',
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
    }
  }
  return {
    barColor: 'bg-red-500',
    bgColor: 'bg-red-100',
    iconColor: 'text-red-600',
  }
}

export function RevenueAnalytics({ data }: RevenueAnalyticsProps) {
  const varianceIsPositive = data.variance >= 0
  const vs = getVarianceStyle(data.variance)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Revenue Analytics</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="overflow-hidden border-0 shadow-md">
            <div className="h-1 bg-blue-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monthly Revenue
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <DollarSign
                  aria-hidden="true"
                  className="h-4 w-4 text-blue-600"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {formatCentsWhole(data.monthlyRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-md">
            <div className="h-1 bg-teal-700" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/10">
                <DollarSign
                  aria-hidden="true"
                  className="h-4 w-4 text-teal-700"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {formatCentsWhole(data.expectedRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on tier rates
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'overflow-hidden border-0 shadow-md',
              data.mismatchCount > 0 && 'ring-2 ring-amber-200'
            )}
          >
            <div className={cn('h-1', vs.barColor)} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variance</CardTitle>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  vs.bgColor
                )}
              >
                {varianceIsPositive ? (
                  <TrendingUp
                    aria-hidden="true"
                    className={cn('h-4 w-4', vs.iconColor)}
                  />
                ) : (
                  <TrendingDown
                    aria-hidden="true"
                    className={cn('h-4 w-4', vs.iconColor)}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums tracking-tight',
                  data.variance > 0 && 'text-green-600',
                  data.variance < 0 && 'text-red-600'
                )}
              >
                {data.variance === 0
                  ? '$0'
                  : `${varianceIsPositive ? '+' : ''}${formatCentsWhole(data.variance)}`}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.mismatchCount === 0
                  ? 'All families paying correct amount'
                  : `${data.mismatchCount} ${data.mismatchCount === 1 ? 'family' : 'families'} mismatched`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Revenue by Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByTier.length > 0 ? (
              <RevenueTierBarChart data={data.revenueByTier} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No active subscriptions
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
