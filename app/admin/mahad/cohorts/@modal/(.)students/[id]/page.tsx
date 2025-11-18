import { notFound } from 'next/navigation'

import { getBatches } from '@/lib/db/queries/batch'
import { getStudentById } from '@/lib/db/queries/student'

import { StudentDetailModal } from './student-detail-modal'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: 'view' | 'edit' }>
}

/**
 * Student Detail Modal (Intercepting Route)
 *
 * This page is shown when navigating to /students/[id] from the cohorts list.
 * It renders as a modal overlay on top of the list.
 *
 * Navigation scenarios:
 * - Click student in list → This modal opens
 * - Refresh page → This modal persists (URL preserves state)
 * - Direct link → Shows full page version instead (see /students/[id]/page.tsx)
 */
export default async function StudentModalPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const searchParamsResolved = await searchParams
  const mode = searchParamsResolved?.mode === 'edit' ? 'edit' : 'view'

  // Fetch both student and batches in parallel
  const [student, batches] = await Promise.all([
    getStudentById(id),
    getBatches(),
  ])

  if (!student) {
    notFound()
  }

  return (
    <StudentDetailModal
      student={student}
      batches={batches}
      initialMode={mode}
    />
  )
}
