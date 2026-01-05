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
