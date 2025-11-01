/**
 * Dashboard Stats Component
 *
 * Displays overview statistics cards.
 * Can potentially be a Server Component for better performance.
 */

import { CreditCard, DollarSign, Users, UserCheck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { DugsiRegistration } from '../../_types'
import { groupRegistrationsByFamily } from '../../_utils/family'

interface DashboardStatsProps {
  registrations: DugsiRegistration[]
}

export function DashboardStats({ registrations }: DashboardStatsProps) {
  // Use centralized utility for family grouping
  const families = groupRegistrationsByFamily(registrations)

  const totalFamilies = families.length
  const totalStudents = registrations.length
  const paymentMethodsCaptured = families.filter((f) => f.hasPayment).length
  const activeSubscriptions = families.filter((f) => f.hasSubscription).length

  // Calculate percentages
  const paymentCaptureRate =
    totalFamilies > 0
      ? Math.round((paymentMethodsCaptured / totalFamilies) * 100)
      : 0
  const subscriptionRate =
    totalFamilies > 0
      ? Math.round((activeSubscriptions / totalFamilies) * 100)
      : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Families</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalFamilies}</div>
          <p className="text-xs text-muted-foreground">
            {totalStudents} total students
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{paymentMethodsCaptured}</div>
          <div className="flex items-center text-xs">
            <span
              className={
                paymentCaptureRate > 75
                  ? 'text-green-600'
                  : paymentCaptureRate > 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }
            >
              {paymentCaptureRate}% captured
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Active Subscriptions
          </CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeSubscriptions}</div>
          <div className="flex items-center text-xs">
            <span
              className={
                subscriptionRate > 75
                  ? 'text-green-600'
                  : subscriptionRate > 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }
            >
              {subscriptionRate}% active
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Setup</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {paymentMethodsCaptured - activeSubscriptions}
          </div>
          <p className="text-xs text-muted-foreground">
            Ready for subscription
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
