import { AlertTriangle, CreditCard, UserCheck, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { ProgramHealthStats } from '../../_types/insights'

interface ProgramHealthCardsProps {
  data: ProgramHealthStats
}

export function ProgramHealthCards({ data }: ProgramHealthCardsProps) {
  const needsAttention =
    data.familyStatusBreakdown.past_due +
    data.familyStatusBreakdown.incomplete +
    data.familyStatusBreakdown.none

  const statusSegments = [
    {
      key: 'active',
      color: 'bg-green-500',
      count: data.familyStatusBreakdown.active,
    },
    {
      key: 'trialing',
      color: 'bg-blue-500',
      count: data.familyStatusBreakdown.trialing,
    },
    {
      key: 'past_due',
      color: 'bg-orange-500',
      count: data.familyStatusBreakdown.past_due,
    },
    {
      key: 'incomplete',
      color: 'bg-yellow-500',
      count: data.familyStatusBreakdown.incomplete,
    },
    {
      key: 'canceled',
      color: 'bg-red-500',
      count: data.familyStatusBreakdown.canceled,
    },
    {
      key: 'unpaid',
      color: 'bg-red-700',
      count: data.familyStatusBreakdown.unpaid,
    },
    {
      key: 'paused',
      color: 'bg-gray-500',
      count: data.familyStatusBreakdown.paused,
    },
    {
      key: 'incomplete_expired',
      color: 'bg-gray-400',
      count: data.familyStatusBreakdown.incomplete_expired,
    },
    {
      key: 'none',
      color: 'bg-slate-300',
      count: data.familyStatusBreakdown.none,
    },
  ].filter((s) => s.count > 0)

  const statusLabels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trialing',
    past_due: 'Past Due',
    incomplete: 'Incomplete',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    paused: 'Paused',
    incomplete_expired: 'Expired',
    none: 'No Subscription',
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-1 bg-teal-700" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Families</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/10">
              <Users aria-hidden="true" className="h-4 w-4 text-teal-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums tracking-tight">
              {data.totalFamilies}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totalStudents} total students ({data.activeStudents} active)
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-1 bg-green-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active & Paying
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <UserCheck
                aria-hidden="true"
                className="h-4 w-4 text-green-600"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums tracking-tight text-green-600">
              {data.familyStatusBreakdown.active}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totalFamilies > 0
                ? Math.round(
                    (data.familyStatusBreakdown.active / data.totalFamilies) *
                      100
                  )
                : 0}
              % of families
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'overflow-hidden border-0 shadow-md',
            needsAttention > 0 && 'ring-2 ring-amber-200'
          )}
        >
          <div
            className={cn(
              'h-1',
              needsAttention > 0 ? 'bg-amber-500' : 'bg-gray-200'
            )}
          />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Needs Attention
            </CardTitle>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                needsAttention > 0 ? 'bg-amber-100' : 'bg-gray-100'
              )}
            >
              <AlertTriangle
                aria-hidden="true"
                className={cn(
                  'h-4 w-4',
                  needsAttention > 0
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
                needsAttention > 0 && 'text-amber-600'
              )}
            >
              {needsAttention}
            </div>
            <p className="text-xs text-muted-foreground">
              Past due, incomplete, or no subscription
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-1 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Payment Capture
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <CreditCard
                aria-hidden="true"
                className="h-4 w-4 text-blue-600"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums tracking-tight">
              {data.paymentMethodCaptureRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Have payment method on file
            </p>
          </CardContent>
        </Card>
      </div>

      {statusSegments.length > 0 && (
        <div className="space-y-2">
          <div
            className="flex h-3 overflow-hidden rounded-full"
            role="img"
            aria-label="Family subscription status breakdown"
          >
            {statusSegments.map((segment) => (
              <div
                key={segment.key}
                className={cn('h-full', segment.color)}
                style={{
                  width: `${(segment.count / data.totalFamilies) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {statusSegments.map((segment) => (
              <div
                key={segment.key}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <div
                  className={cn('h-2.5 w-2.5 rounded-full', segment.color)}
                />
                {statusLabels[segment.key]} ({segment.count})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
