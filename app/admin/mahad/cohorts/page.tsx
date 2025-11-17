import { Suspense } from 'react'

import { EducationLevel, GradeLevel, SubscriptionStatus } from '@prisma/client'
import { Metadata } from 'next'


import { Separator } from '@/components/ui/separator'
import { getBatches } from '@/lib/db/queries/batch'
import {
  getStudentsWithBatch,
  getStudentsWithBatchFiltered,
  findDuplicateStudents,
} from '@/lib/db/queries/student'
import { StudentStatus } from '@/lib/types/student'

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

// Parse and normalize search params with validation
function parseSearchParams(params: Awaited<SearchParams>) {
  // Helper to ensure array
  const toArray = (val: string | string[] | undefined): string[] => {
    if (!val) return []
    return Array.isArray(val) ? val : [val]
  }

  // Validate enum values against actual enum types
  const validStatuses = Object.values(StudentStatus)
  const validSubscriptionStatuses = Object.values(SubscriptionStatus)
  const validEducationLevels = Object.values(EducationLevel)
  const validGradeLevels = Object.values(GradeLevel)

  return {
    search: params.search || undefined,
    batchIds: toArray(params.batch),
    // Filter out invalid status values from URL
    statuses: toArray(params.status).filter((s) =>
      validStatuses.includes(s as StudentStatus)
    ),
    // Filter out invalid subscription status values from URL
    subscriptionStatuses: toArray(params.subscriptionStatus).filter((s) =>
      validSubscriptionStatuses.includes(s as SubscriptionStatus)
    ),
    // Filter out invalid education level values from URL
    educationLevels: toArray(params.educationLevel).filter((e) =>
      validEducationLevels.includes(e as EducationLevel)
    ) as EducationLevel[],
    // Filter out invalid grade level values from URL
    gradeLevels: toArray(params.gradeLevel).filter((g) =>
      validGradeLevels.includes(g as GradeLevel)
    ) as GradeLevel[],
    page: params.page ? Math.max(1, parseInt(params.page, 10)) : 1,
    limit: params.limit
      ? Math.min(Math.max(1, parseInt(params.limit, 10)), 100)
      : 50,
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
