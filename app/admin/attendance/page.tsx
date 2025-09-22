import { Suspense } from 'react'
import { AttendanceManagement } from './components/attendance-management'
import { AttendanceStats } from './components/attendance-stats'
import { CreateSessionDialog } from './components/create-session-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function AttendancePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekend Attendance</h1>
          <p className="text-muted-foreground">
            Manage attendance for weekend study sessions
          </p>
        </div>
        <CreateSessionDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Session
          </Button>
        </CreateSessionDialog>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <AttendanceStats />
      </Suspense>

      <Suspense fallback={<div>Loading attendance...</div>}>
        <AttendanceManagement />
      </Suspense>
    </div>
  )
}