import { Suspense } from 'react'

import { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'
import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatch } from '@/lib/db/queries/student'
import { isFeatureEnabled } from '@/lib/feature-flags'

import { ConsolidatedMahadDashboard } from './components/consolidated-mahad-dashboard'
import { MahadDashboard } from './components/mahad-dashboard'
import { BackfillPaymentsButton } from './payments/components/backfill-button'
import {
  StatsCardsSkeleton,
  TableSkeleton,
} from './payments/components/loading-skeleton'
import { StatsCards } from './payments/components/stats-cards'
import { StudentsTableShell } from './payments/components/students-table-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mahad Cohorts',
  description: 'Manage Mahad student cohorts and batches',
}

function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="animate-pulse">
        <div className="mb-6 h-8 w-64 rounded bg-muted" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="h-10 flex-1 rounded-md bg-muted" />
          <div className="h-10 w-24 rounded-md bg-muted" />
        </div>
        <div className="mb-6 flex gap-2">
          <div className="h-9 w-24 rounded-md bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
        </div>
        <div className="h-96 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

interface MahadCohortsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MahadCohortsPage({
  searchParams,
}: MahadCohortsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = resolvedSearchParams.tab as string | undefined

  const [batches, students] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
  ])

  const useConsolidatedUI = isFeatureEnabled('consolidatedAdminUI')

  if (useConsolidatedUI) {
    return (
      <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
        <AppErrorBoundary
          context="Mahad cohorts dashboard"
          variant="card"
          fallbackUrl="/admin/mahad"
          fallbackLabel="Reload Dashboard"
        >
          <Suspense fallback={<Loading />}>
            <ConsolidatedMahadDashboard
              students={students}
              batches={batches}
              paymentsContent={
                activeTab === 'payments' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Payments Dashboard
                        </h2>
                        <p className="text-sm text-muted-foreground sm:text-base">
                          Manage student enrollments, billing, and payment
                          tracking
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
                ) : null
              }
            />
          </Suspense>
        </AppErrorBoundary>
      </main>
    )
  }

  return (
    <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
      <AppErrorBoundary
        context="Mahad cohorts dashboard"
        variant="card"
        fallbackUrl="/admin/mahad"
        fallbackLabel="Reload Dashboard"
      >
        <Suspense fallback={<Loading />}>
          <MahadDashboard students={students} batches={batches} />
        </Suspense>
      </AppErrorBoundary>
    </main>
  )
}
