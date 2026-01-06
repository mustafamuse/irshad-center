import { Metadata } from 'next'

import {
  getClassesWithDetailsAction,
  getAllTeachersForClassAssignmentAction,
} from '../actions'
import { ClassManagement } from './_components/class-management'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Class Management - Dugsi Admin',
  description: 'Manage Dugsi classes and teacher assignments',
}

export default async function ClassManagementPage() {
  const [classesResult, teachersResult] = await Promise.all([
    getClassesWithDetailsAction(),
    getAllTeachersForClassAssignmentAction(),
  ])

  if (!classesResult.success || !teachersResult.success) {
    return (
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">
            Failed to load data: {classesResult.error || teachersResult.error}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8">
      <ClassManagement
        classes={classesResult.data ?? []}
        teachers={teachersResult.data ?? []}
      />
    </main>
  )
}
