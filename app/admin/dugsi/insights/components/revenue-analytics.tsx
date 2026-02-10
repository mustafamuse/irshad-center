import { TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { RevenueTierChart } from './charts/revenue-tier-chart'
import type { RevenueStats } from '../../_types/insights'
import { formatCentsWhole } from '../../_utils/format'

interface RevenueAnalyticsProps {
  data: RevenueStats
}

export function RevenueAnalytics({ data }: RevenueAnalyticsProps) {
  const varianceIsPositive = data.variance >= 0

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Revenue Analytics</h3>
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-md bg-teal-50 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Monthly</span>
              <span className="text-sm font-bold tabular-nums">
                {formatCentsWhole(data.monthlyRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Expected</span>
              <span className="text-sm font-bold tabular-nums">
                {formatCentsWhole(data.expectedRevenue)}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5',
                data.variance > 0 && 'bg-green-50',
                data.variance < 0 && 'bg-red-50',
                data.variance === 0 && 'bg-gray-100'
              )}
            >
              {varianceIsPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
              <span
                className={cn(
                  'text-sm font-bold tabular-nums',
                  data.variance > 0 && 'text-green-600',
                  data.variance < 0 && 'text-red-600'
                )}
              >
                {data.variance === 0
                  ? '$0'
                  : `${varianceIsPositive ? '+' : ''}${formatCentsWhole(data.variance)}`}
              </span>
              {data.mismatchCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({data.mismatchCount} mismatched)
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardHeader className="pb-2 pt-0">
          <CardTitle className="text-sm font-medium">Revenue by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenueByTier.length > 0 ? (
            <RevenueTierChart data={data.revenueByTier} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No active subscriptions
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
