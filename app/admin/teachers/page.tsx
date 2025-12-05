import { Suspense } from 'react'

import { getTeachers } from './actions'
import { TeacherList } from './components/teacher-list'

export default async function TeachersPage() {
  const result = await getTeachers()

  if (!result.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">
            Failed to load teachers: {result.error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Teachers</h1>
        <p className="mt-2 text-muted-foreground">
          Manage teachers and their program assignments
        </p>
      </div>

      <Suspense fallback={<div>Loading teachers...</div>}>
        <TeacherList teachers={result.data} />
      </Suspense>
    </div>
  )
}
