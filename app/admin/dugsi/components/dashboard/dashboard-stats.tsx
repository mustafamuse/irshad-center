/**
 * Dashboard Stats Component
 */

import {
  AlertCircle,
  DollarSign,
  RotateCcw,
  TrendingDown,
  UserCheck,
  Users,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { DugsiRegistration } from '../../_types'
import { getBillingStatus } from '../../_utils/billing'
import { groupRegistrationsByFamily } from '../../_utils/family'

interface DugsiStatsProps {
  registrations: DugsiRegistration[]
}

export function DugsiStats({ registrations }: DugsiStatsProps) {
  const families = groupRegistrationsByFamily(registrations)

  const totalFamilies = families.length
  const totalStudents = registrations.length
  const payingFamilies = families.filter((f) => f.hasSubscription).length
  const churnedFamilies = families.filter(
    (f) => f.hasChurned && !f.hasSubscription
  ).length
  const noPaymentFamilies = families.filter(
    (f) => !f.hasPayment && !f.hasChurned
  ).length
  const payingRate =
    totalFamilies > 0 ? Math.round((payingFamilies / totalFamilies) * 100) : 0

  const monthlyRevenue = families
    .filter((f) => f.hasSubscription)
    .reduce((sum, family) => {
      const activeStudent = family.members.find(
        (m) => m.subscriptionStatus === 'active' && m.subscriptionAmount
      )
      return sum + (activeStudent?.subscriptionAmount ?? 0)
    }, 0)

  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(monthlyRevenue / 100)

  const revenueStats = families.reduce(
    (acc, family) => {
      if (!family.hasSubscription) return acc

      const member = family.members[0]
      if (!member) return acc

      const billing = getBillingStatus(member)
      acc.expected += billing.expected
      acc.actual += billing.actual ?? 0
      if (billing.status !== 'match' && billing.status !== 'no-subscription') {
        acc.mismatchCount++
      }

      return acc
    },
    { expected: 0, actual: 0, mismatchCount: 0 }
  )

  const variance = revenueStats.actual - revenueStats.expected
  const isUnder = variance < 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card className="overflow-hidden border-0 shadow-md transition-all hover:shadow-lg">
        <div className="h-1 bg-[#007078]" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Families</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
            <Users className="h-4 w-4 text-[#007078]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tracking-tight">
            {totalFamilies}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalStudents} total students
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-md transition-all hover:shadow-lg">
        <div className="h-1 bg-green-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Enrolled & Paying
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
            <UserCheck className="h-4 w-4 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tracking-tight text-green-600">
            {payingFamilies}
          </div>
          <p className="text-xs text-muted-foreground">
            {payingRate}% of families
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'overflow-hidden border-0 shadow-md transition-all hover:shadow-lg',
          noPaymentFamilies > 0 && 'ring-2 ring-amber-200'
        )}
      >
        <div
          className={cn(
            'h-1',
            noPaymentFamilies > 0 ? 'bg-amber-500' : 'bg-gray-200'
          )}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">No Payment</CardTitle>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              noPaymentFamilies > 0 ? 'bg-amber-100' : 'bg-gray-100'
            )}
          >
            <AlertCircle
              className={cn(
                'h-4 w-4',
                noPaymentFamilies > 0
                  ? 'text-amber-600'
                  : 'text-muted-foreground'
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-3xl font-bold tracking-tight',
              noPaymentFamilies > 0 ? 'text-amber-600' : ''
            )}
          >
            {noPaymentFamilies}
          </div>
          <p className="text-xs text-muted-foreground">Send payment link</p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'overflow-hidden border-0 shadow-md transition-all hover:shadow-lg',
          churnedFamilies > 0 && 'ring-2 ring-gray-300'
        )}
      >
        <div
          className={cn(
            'h-1',
            churnedFamilies > 0 ? 'bg-gray-500' : 'bg-gray-200'
          )}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Churned</CardTitle>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              churnedFamilies > 0 ? 'bg-gray-100' : 'bg-gray-100'
            )}
          >
            <RotateCcw
              className={cn(
                'h-4 w-4',
                churnedFamilies > 0 ? 'text-gray-600' : 'text-muted-foreground'
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-3xl font-bold tracking-tight',
              churnedFamilies > 0 ? 'text-gray-600' : ''
            )}
          >
            {churnedFamilies}
          </div>
          <p className="text-xs text-muted-foreground">Win back opportunity</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-md transition-all hover:shadow-lg">
        <div className="h-1 bg-blue-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tracking-tight">
            {formattedRevenue}
          </div>
          <p className="text-xs text-muted-foreground">
            From {payingFamilies} families
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-md transition-all hover:shadow-lg">
        <div
          className={cn(
            'h-1',
            variance === 0
              ? 'bg-gray-200'
              : isUnder
                ? 'bg-red-500'
                : 'bg-green-500'
          )}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue Variance
          </CardTitle>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              variance === 0
                ? 'bg-gray-100'
                : isUnder
                  ? 'bg-red-100'
                  : 'bg-green-100'
            )}
          >
            <TrendingDown
              className={cn(
                'h-4 w-4',
                variance === 0
                  ? 'text-muted-foreground'
                  : isUnder
                    ? 'text-red-600'
                    : 'text-green-600'
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-3xl font-bold tracking-tight',
              variance === 0 ? '' : isUnder ? 'text-red-600' : 'text-green-600'
            )}
          >
            {variance === 0
              ? '$0'
              : `${isUnder ? '-' : '+'}$${Math.abs(variance / 100).toFixed(0)}`}
          </div>
          <p className="text-xs text-muted-foreground">
            {revenueStats.mismatchCount === 0
              ? 'All families paying correct amount'
              : `${revenueStats.mismatchCount} ${revenueStats.mismatchCount === 1 ? 'family' : 'families'} mismatched`}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
