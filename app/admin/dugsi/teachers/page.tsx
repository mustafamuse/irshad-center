import { redirect } from 'next/navigation'

import { isFeatureEnabled } from '@/lib/feature-flags'

import { getTeachers } from './actions'
import { TeachersDashboard } from './components/teachers-dashboard'

export default async function TeachersPage() {
  if (isFeatureEnabled('consolidatedAdminUI')) {
    redirect('/admin/dugsi?tab=teachers')
  }

  const result = await getTeachers('DUGSI_PROGRAM')

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
      <TeachersDashboard teachers={result.data} />
    </div>
  )
}
