import { Users, CheckCircle2, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSiblingGroupsByProgram, getDiscountEligibleSiblings } from '@/lib/db/queries/siblings'

export async function SiblingStats() {
  const [allGroups, discountEligible] = await Promise.all([
    getSiblingGroupsByProgram(),
    getDiscountEligibleSiblings(),
  ])

  const totalSiblings = allGroups.reduce((sum, group) => sum + group.length, 0)
  const totalGroups = allGroups.length
  const eligibleCount = discountEligible.length

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sibling Groups</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalGroups}</div>
          <p className="text-xs text-muted-foreground">
            {totalSiblings} total siblings across all groups
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Discount Eligible</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{eligibleCount}</div>
          <p className="text-xs text-muted-foreground">
            Groups with 2+ enrolled siblings
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {totalGroups - eligibleCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Groups pending verification
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

