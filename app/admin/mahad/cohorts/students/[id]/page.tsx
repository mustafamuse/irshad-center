import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'
import { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { getBatches } from '@/lib/db/queries/batch'
import { getStudentById } from '@/lib/db/queries/student'

import { StudentDetailPageClient } from './student-detail-page-client'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: 'view' | 'edit' }>
}

/**
 * Student Detail Full Page
 *
 * This page is shown when navigating directly to /students/[id] via:
 * - Direct URL entry
 * - Sharing a link
 * - Opening link in new tab
 *
 * When navigating from the cohorts list, the modal version is shown instead
 * (via intercepting route @modal/(..)students/[id]).
 */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const student = await getStudentById(id)

  if (!student) {
    return {
      title: 'Student Not Found',
    }
  }

  return {
    title: `${student.name} - Student Profile`,
    description: `View profile and details for ${student.name} | ${student.status} | ${student.Batch?.name || 'Unassigned'}`,
    openGraph: {
      title: `${student.name} - Student Profile`,
      description: `${student.status} | ${student.Batch?.name || 'Unassigned'}`,
    },
  }
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const searchParamsResolved = await searchParams

  const [student, batches] = await Promise.all([
    getStudentById(id),
    getBatches(),
  ])

  if (!student) {
    notFound()
  }

  const mode = searchParamsResolved?.mode === 'edit' ? 'edit' : 'view'

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div>
        <Link href="/admin/mahad/cohorts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cohorts
          </Button>
        </Link>
      </div>

      {/* Student Details Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{student.name}</h1>
          <p className="text-sm text-muted-foreground">
            Student ID: {student.id}
          </p>
        </div>

        <StudentDetailPageClient
          student={student}
          batches={batches}
          initialMode={mode}
        />
      </div>
    </div>
  )
}
