/**
 * Dashboard Stats Component
 */

import { AlertCircle, DollarSign, UserCheck, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { DugsiRegistration } from '../../_types'
import { groupRegistrationsByFamily } from '../../_utils/family'

interface DugsiStatsProps {
  registrations: DugsiRegistration[]
}

export function DugsiStats({ registrations }: DugsiStatsProps) {
  const families = groupRegistrationsByFamily(registrations)

  const totalFamilies = families.length
  const totalStudents = registrations.length
  const payingFamilies = families.filter((f) => f.hasSubscription).length
  const actionNeeded = totalFamilies - payingFamilies
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Families</CardTitle>
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
          <CardTitle className="text-sm font-medium">
            Enrolled & Paying
          </CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{payingFamilies}</div>
          <p className="text-xs text-muted-foreground">
            {payingRate}% of families
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Action Needed</CardTitle>
          <AlertCircle
            className={`h-4 w-4 ${actionNeeded > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}
          />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{actionNeeded}</div>
          <p className="text-xs text-muted-foreground">Send payment link</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formattedRevenue}</div>
          <p className="text-xs text-muted-foreground">
            From {payingFamilies} families
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
