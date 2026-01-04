import { getAllDugsiTeachersWithTodayStatus } from '@/lib/db/queries/teacher-checkin'

import { CheckinDashboard } from './components/checkin-dashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Teacher Check-ins | Dugsi Admin',
  description: 'Manage teacher clock-in/clock-out records',
}

export default async function TeacherCheckinsPage() {
  const todayData = await getAllDugsiTeachersWithTodayStatus()

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Teacher Check-ins</h1>
        <p className="text-muted-foreground">
          Track and manage Dugsi teacher attendance
        </p>
      </div>

      <CheckinDashboard initialTodayData={todayData} />
    </div>
  )
}
