import { PHASE2_EXCUSE_ENABLED } from '@/lib/feature-flags'

import { getDugsiTeachers } from './actions'
import { CheckinForm } from './components/checkin-form'

export const dynamic = 'force-dynamic'

export default async function TeacherCheckinPage() {
  const teachers = await getDugsiTeachers()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#007078]/5 via-white to-gray-50/50">
      <div className="mx-auto max-w-md px-4 py-6 sm:py-8">
        <div className="mb-4 text-center sm:mb-6">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">
            Teacher Check-in
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
            Dugsi shift clock in / clock out
          </p>
        </div>

        <CheckinForm
          teachers={teachers}
          phase2ExcuseEnabled={PHASE2_EXCUSE_ENABLED}
        />
      </div>
    </div>
  )
}
