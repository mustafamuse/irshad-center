import { AlertTriangle, CreditCard, PercentCircle, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { FinancialKPIs } from '../../_types/insights'
import { formatCentsWhole } from '../../_utils/format'

interface FinancialKPICardsProps {
  data: FinancialKPIs
}

export function FinancialKPICards({ data }: FinancialKPICardsProps) {
  const atRiskIsZero = data.dollarAtRisk === 0
  const collectionHealthy = data.collectionRate >= 95

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card className="overflow-hidden border-0 shadow-md">
        <div className="h-1 bg-teal-700" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Families</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/10">
            <Users aria-hidden="true" className="h-4 w-4 text-teal-700" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
            {data.totalFamilies}
          </div>
          <p className="text-xs text-muted-foreground">Active Dugsi families</p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'overflow-hidden border-0 shadow-md',
          !collectionHealthy && 'ring-2 ring-amber-200'
        )}
      >
        <div
          className={cn(
            'h-1',
            collectionHealthy ? 'bg-green-500' : 'bg-amber-500'
          )}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              collectionHealthy ? 'bg-green-100' : 'bg-amber-100'
            )}
          >
            <PercentCircle
              aria-hidden="true"
              className={cn(
                'h-4 w-4',
                collectionHealthy ? 'text-green-600' : 'text-amber-600'
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
              collectionHealthy ? 'text-green-600' : 'text-amber-600'
            )}
          >
            {data.collectionRate}%
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {formatCentsWhole(data.monthlyRevenue)} of{' '}
            {formatCentsWhole(data.expectedRevenue)} expected
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'overflow-hidden border-0 shadow-md',
          !atRiskIsZero && 'ring-2 ring-red-200'
        )}
      >
        <div
          className={cn('h-1', atRiskIsZero ? 'bg-gray-200' : 'bg-red-500')}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">$ At Risk</CardTitle>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              atRiskIsZero ? 'bg-gray-100' : 'bg-red-100'
            )}
          >
            <AlertTriangle
              aria-hidden="true"
              className={cn(
                'h-4 w-4',
                atRiskIsZero ? 'text-muted-foreground' : 'text-red-600'
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
              !atRiskIsZero && 'text-red-600'
            )}
          >
            {formatCentsWhole(data.dollarAtRisk)}
          </div>
          <p className="text-xs text-muted-foreground">
            Revenue from at-risk families
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-md">
        <div className="h-1 bg-teal-700" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payment Capture</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/10">
            <CreditCard aria-hidden="true" className="h-4 w-4 text-teal-700" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
            {data.paymentCaptureRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            Have payment method on file
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
