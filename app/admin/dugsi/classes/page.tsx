import { Metadata } from 'next'

import {
  getClassesWithDetailsAction,
  getAllTeachersForClassAssignmentAction,
  getUnassignedStudentsAction,
} from '../actions'
import { ClassManagement } from './_components/class-management'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Class Management - Dugsi Admin',
  description: 'Manage Dugsi classes and teacher assignments',
}

export default async function ClassManagementPage() {
  const [classesResult, teachersResult, unassignedResult] = await Promise.all([
    getClassesWithDetailsAction(),
    getAllTeachersForClassAssignmentAction(),
    getUnassignedStudentsAction(),
  ])

  if (
    !classesResult.success ||
    !teachersResult.success ||
    !unassignedResult.success
  ) {
    return (
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">
            Failed to load data:{' '}
            {classesResult.error ||
              teachersResult.error ||
              unassignedResult.error}
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
        unassignedStudents={
          unassignedResult.success ? (unassignedResult.data ?? []) : []
        }
      />
    </main>
  )
}
