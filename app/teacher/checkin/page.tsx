import { getDugsiTeachers } from './actions'
import { CheckinForm } from './components/checkin-form'

export const dynamic = 'force-dynamic'

export default async function TeacherCheckinPage() {
  const teachers = await getDugsiTeachers()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Teacher Check-in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Clock in and out for your Dugsi shift
          </p>
        </div>

        <CheckinForm teachers={teachers} />
      </div>
    </div>
  )
}
