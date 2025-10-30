import { Suspense } from 'react'

import {
  StatsCardsSkeleton,
  SubscriptionsListSkeleton,
} from './components/loading-skeletons'
import { StatsCards } from './components/stats-cards'
import { SubscriptionsListShell } from './components/subscriptions-list-shell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Link Subscriptions | Admin',
  description: 'Link orphaned Stripe subscriptions to students',
}

export default function LinkSubscriptionsPage() {
  return (
    <div className="min-h-screen flex-1 space-y-6 bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Link Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Connect orphaned Stripe subscriptions to students in the database
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
