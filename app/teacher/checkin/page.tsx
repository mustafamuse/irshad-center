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
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#007078] shadow-lg shadow-[#007078]/25 ring-4 ring-[#deb43e]/30 ring-offset-2">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Teacher Check-in
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Clock in and out for your Dugsi shift
          </p>
        </div>

        <CheckinForm teachers={teachers} />
      </div>
    </div>
  )
}
