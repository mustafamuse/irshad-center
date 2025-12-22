import { Suspense } from 'react'

import { Shift } from '@prisma/client'
import { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'

import { ClassesDashboard } from './_components/classes-dashboard'
import { getClassesAction } from './actions'

export const dynamic = 'force-dynamic'

function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="animate-pulse">
        <div className="mb-6 h-8 w-48 rounded bg-muted" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="h-10 flex-1 rounded-md bg-muted" />
          <div className="h-10 w-32 rounded-md bg-muted" />
        </div>
        <div className="h-96 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Classes | Dugsi Admin',
  description: 'Manage Dugsi classes and student assignments',
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams?: Promise<{ shift?: string }>
}) {
  const params = await searchParams
  const shiftParam = params?.shift?.toUpperCase()
  const shift =
    shiftParam === 'MORNING' || shiftParam === 'AFTERNOON'
      ? (shiftParam as Shift)
      : undefined

  const result = await getClassesAction({ activeOnly: false, shift })
  const classes = result.success && result.data ? result.data : []

  return (
    <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
      <AppErrorBoundary
        context="Dugsi classes management"
        variant="card"
        fallbackUrl="/admin/dugsi/classes"
        fallbackLabel="Reload Classes"
      >
        <Suspense fallback={<Loading />}>
          <ClassesDashboard classes={classes} currentShift={shift} />
        </Suspense>
      </AppErrorBoundary>
    </main>
  )
}
