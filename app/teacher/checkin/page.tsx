/**
 * Teacher Check-in Self-Service Page
 *
 * SECURITY NOTE: This page intentionally has no authentication.
 * Design decision rationale:
 * - Teachers select themselves from a dropdown (no login required)
 * - GPS validation provides accountability (location is recorded)
 * - Admin dashboard provides oversight and can edit/delete records
 * - This mirrors existing paper sign-in sheet workflow
 *
 * If authentication is needed in the future, consider:
 * - Adding PIN codes per teacher
 * - Integrating with school's existing auth system
 * - Using QR codes tied to teacher devices
 */

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

        <CheckinForm teachers={teachers} />
      </div>
    </div>
  )
}
