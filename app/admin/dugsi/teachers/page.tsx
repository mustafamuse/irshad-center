import {
  getTeachers,
  getTeachersForDropdownAction,
  getTeachersWithCheckinStatusAction,
} from './actions'
import { getWeekendDates } from './components/date-utils'
import { TeachersDashboard } from './components/teachers-dashboard'

export default async function TeachersPage() {
  const defaultDate = getWeekendDates(0).start

  const [result, checkinResult, dropdownResult] = await Promise.all([
    getTeachers('DUGSI_PROGRAM'),
    getTeachersWithCheckinStatusAction(defaultDate),
    getTeachersForDropdownAction(),
  ])

  if (!checkinResult.success) {
    console.warn('Failed to prefetch checkin statuses:', checkinResult.error)
  }
  if (!dropdownResult.success) {
    console.warn('Failed to prefetch teacher options:', dropdownResult.error)
  }

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
      <TeachersDashboard
        teachers={result.data}
        initialCheckinStatuses={
          checkinResult.success ? checkinResult.data : undefined
        }
        initialTeacherOptions={
          dropdownResult.success ? dropdownResult.data : undefined
        }
      />
    </div>
  )
}
