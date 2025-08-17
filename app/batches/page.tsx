import { Suspense } from 'react'

import { Metadata } from 'next'

import { Separator } from '@/components/ui/separator'

import { Providers } from '../providers'
import { BatchManagement } from './components/batch-management'
import { BatchesTable } from './components/batches-table'
import { DuplicateStudentsClient } from './components/duplicate-students-client'
import { BatchErrorBoundary } from './components/error-boundary'

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading...</div>
}

export const metadata: Metadata = {
  title: 'Batch Management',
  description: 'Manage student batches and assignments',
}

export default function BatchesPage() {
  return (
    <Providers>
      <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <DuplicateStudentsClient />
          </Suspense>
        </BatchErrorBoundary>

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <BatchManagement />
          </Suspense>
        </BatchErrorBoundary>

        <Separator className="my-4 sm:my-6 lg:my-8" />

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <BatchesTable />
          </Suspense>
        </BatchErrorBoundary>
      </main>
    </Providers>
  )
}
