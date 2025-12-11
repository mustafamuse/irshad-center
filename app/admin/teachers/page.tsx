import { getTeachers } from './actions'
import { TeachersPageClient } from './components/teachers-page-client'

export default async function TeachersPage() {
  const result = await getTeachers()

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">
            Failed to load teachers: {result.error ?? 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <TeachersPageClient teachers={result.data} />
    </div>
  )
}
