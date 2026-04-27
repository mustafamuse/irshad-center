import { getAttendanceConfig } from '@/lib/db/queries/teacher-attendance'

import { SettingsForm } from './components/settings-form'

export const dynamic = 'force-dynamic'

export default async function AttendanceSettingsPage() {
  const config = await getAttendanceConfig()

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how many minutes after class start before absent teachers are auto-marked as Late.
        </p>
      </div>

      <SettingsForm
        initialMorning={config.morningAutoMarkMinutes}
        initialAfternoon={config.afternoonAutoMarkMinutes}
      />
    </div>
  )
}
