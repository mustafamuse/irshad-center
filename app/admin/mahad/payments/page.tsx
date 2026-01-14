import { Suspense } from 'react'

import { redirect } from 'next/navigation'

import { isFeatureEnabled } from '@/lib/feature-flags'

import { BackfillPaymentsButton } from './components/backfill-button'
import {
  StatsCardsSkeleton,
  TableSkeleton,
} from './components/loading-skeleton'
import { StatsCards } from './components/stats-cards'
import { StudentsTableShell } from './components/students-table-shell'

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Payments | Dashboard',
  description: 'View and manage student billing and payments.',
}

interface PaymentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PaymentsPage({
  searchParams,
}: PaymentsPageProps) {
  if (isFeatureEnabled('consolidatedAdminUI')) {
    redirect('/admin/mahad?tab=payments')
  }

  const resolvedSearchParams = await searchParams

  return (
    <div className="min-h-screen flex-1 space-y-6 bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Payments Dashboard
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage student enrollments, billing, and payment tracking
          </p>
        </div>
        <BackfillPaymentsButton />
      </div>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <StudentsTableShell searchParams={resolvedSearchParams} />
      </Suspense>
    </div>
  )
}
