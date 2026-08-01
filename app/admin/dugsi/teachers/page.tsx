import { getTeachers } from './actions'
import { TeachersDashboard } from './components/teachers-dashboard'

export default async function TeachersPage() {
  const result = await getTeachers({ program: 'DUGSI_PROGRAM' })

  if (!result?.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">
            Failed to load teachers: {result?.serverError ?? 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <TeachersDashboard teachers={result.data} />
    </div>
  )
}
