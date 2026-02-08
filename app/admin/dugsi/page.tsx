import { Suspense } from 'react'

import { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'
import { ShiftFilterSchema } from '@/lib/validations/dugsi'

import { getDugsiRegistrations } from './actions'
import { CompactStatsSummary } from './components/dashboard/compact-stats-summary'
import { DugsiDashboard } from './components/dugsi-dashboard'

export const dynamic = 'force-dynamic'

function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6 h-8 w-64 rounded bg-muted" />

        {/* Stats cards skeleton */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>

        {/* Search and filter bar skeleton */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="h-10 flex-1 rounded-md bg-muted" />
          <div className="h-10 w-24 rounded-md bg-muted" />
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="h-9 w-24 rounded-md bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
        </div>

        {/* Content area skeleton */}
        <div className="h-96 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Dugsi Admin',
  description: 'Manage Dugsi program registrations and families',
}

export default async function DugsiAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ shift?: string }>
}) {
  const params = await searchParams
  const shift = ShiftFilterSchema.parse(params?.shift)

  const registrations = await getDugsiRegistrations({ shift })

  return (
    <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
      <AppErrorBoundary
        context="Dugsi stats summary"
        variant="card"
        fallbackUrl="/admin/dugsi"
        fallbackLabel="Reload Dashboard"
      >
        <Suspense
          fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}
        >
          <CompactStatsSummary />
        </Suspense>
      </AppErrorBoundary>
      <AppErrorBoundary
        context="Dugsi admin dashboard"
        variant="card"
        fallbackUrl="/admin/dugsi"
        fallbackLabel="Reload Dashboard"
      >
        <Suspense fallback={<Loading />}>
          <DugsiDashboard registrations={registrations} />
        </Suspense>
      </AppErrorBoundary>
    </main>
  )
}
