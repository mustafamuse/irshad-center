import { Suspense } from 'react'
import {
  StatsCardsSkeleton,
  SubscriptionsListSkeleton,
} from './components/loading-skeletons'
import { StatsCards } from './components/stats-cards'
import { SubscriptionsListShell } from './components/subscriptions-list-shell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Link Subscriptions | Billing',
  description: 'Connect orphaned Stripe subscriptions to students in the database',
}

export default function LinkSubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Link Orphaned Subscriptions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Match Stripe subscriptions that aren't linked to any students
          </p>
        </div>
      </div>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      <Suspense fallback={<SubscriptionsListSkeleton />}>
        <SubscriptionsListShell />
      </Suspense>
    </div>
  )
}