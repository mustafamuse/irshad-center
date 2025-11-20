import { Suspense } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SiblingManagementTable } from './_components/sibling-management-table'
import { SiblingStats } from './_components/sibling-stats'

export const metadata = {
  title: 'Sibling Management | Admin',
  description: 'Manage sibling relationships across all programs',
}

export default function SiblingManagementPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sibling Management</h1>
        <p className="text-muted-foreground">
          Track and manage sibling relationships across all programs for discount eligibility
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <SiblingStats />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Sibling Groups</CardTitle>
          <CardDescription>
            View and manage sibling relationships. Groups with 2+ enrolled siblings are
            eligible for discounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading sibling groups...</div>}>
            <SiblingManagementTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

