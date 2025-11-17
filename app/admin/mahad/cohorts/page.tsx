import { Suspense } from 'react'

import { EducationLevel, GradeLevel } from '@prisma/client'
import { Metadata } from 'next'

import { Separator } from '@/components/ui/separator'
import { getBatches } from '@/lib/db/queries/batch'
import {
  getStudentsWithBatch,
  getStudentsWithBatchFiltered,
  findDuplicateStudents,
} from '@/lib/db/queries/student'

import { BatchManagement } from './components/batch-management'
import { DuplicateDetector } from './components/duplicate-detection'
import { BatchErrorBoundary } from './components/error-boundary'
import { StudentsTable } from './components/students-table'
import { Providers } from '../../../providers'

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading...</div>
}

export const metadata: Metadata = {
  title: 'Cohort Management',
  description: 'Manage student cohorts and assignments',
}

// Define search params type
type SearchParams = Promise<{
  search?: string
  batch?: string | string[]
  status?: string | string[]
  subscriptionStatus?: string | string[]
  educationLevel?: string | string[]
  gradeLevel?: string | string[]
  page?: string
  limit?: string
}>

// Parse and normalize search params
function parseSearchParams(params: Awaited<SearchParams>) {
  // Helper to ensure array
  const toArray = (val: string | string[] | undefined): string[] => {
    if (!val) return []
    return Array.isArray(val) ? val : [val]
  }

  return {
    search: params.search || undefined,
    batchIds: toArray(params.batch),
    statuses: toArray(params.status),
    subscriptionStatuses: toArray(params.subscriptionStatus),
    educationLevels: toArray(params.educationLevel) as EducationLevel[],
    gradeLevels: toArray(params.gradeLevel) as GradeLevel[],
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: params.limit ? parseInt(params.limit, 10) : 50,
  }
}

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const resolvedParams = await searchParams

  // Parse filters from URL
  const filters = parseSearchParams(resolvedParams)

  // Fetch data in parallel with server-side filtering
  const [batches, studentsPage, allStudents, duplicates] = await Promise.all([
    getBatches(),
    getStudentsWithBatchFiltered(filters), // NEW: filtered query
    getStudentsWithBatch(), // Keep for BatchManagement (needs all students)
    findDuplicateStudents(),
  ])

  return (
    <Providers>
      <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <DuplicateDetector duplicates={duplicates} />
          </Suspense>
        </BatchErrorBoundary>

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            {/* BatchManagement still gets all students for counts */}
            <BatchManagement batches={batches} students={allStudents} />
          </Suspense>
        </BatchErrorBoundary>

        <Separator className="my-4 sm:my-6 lg:my-8" />

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            {/* NEW: Pass pagination metadata */}
            <StudentsTable
              students={studentsPage.students}
              batches={batches}
              totalCount={studentsPage.totalCount}
              currentPage={studentsPage.page}
              totalPages={studentsPage.totalPages}
            />
          </Suspense>
        </BatchErrorBoundary>
      </main>
    </Providers>
  )
}
