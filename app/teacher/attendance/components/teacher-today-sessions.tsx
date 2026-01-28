import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getTodaySessions } from '@/lib/db/queries/dugsi-attendance'

interface Props {
  teacherId: string
}

function getNextWeekendDate(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  const nextSaturday = new Date(today)
  nextSaturday.setDate(today.getDate() + daysUntilSaturday)
  return nextSaturday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export async function TeacherTodaySessions({ teacherId }: Props) {
  const today = new Date()
  const isWeekend = today.getUTCDay() === 0 || today.getUTCDay() === 6

  if (!isWeekend) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Attendance is available on weekends. Next session:{' '}
          {getNextWeekendDate()}.
        </p>
      </Card>
    )
  }

  const sessions = await getTodaySessions(teacherId)

  if (sessions.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          No sessions found for today.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Today&apos;s Classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const totalStudents = session.records.length
            const presentCount = session.records.filter(
              (r) => r.status === 'PRESENT' || r.status === 'LATE'
            ).length

            let statusText: string
            let statusColor: string
            if (totalStudents === 0) {
              statusText = 'Not started'
              statusColor = 'text-muted-foreground'
            } else {
              statusText = `${presentCount}/${totalStudents} present`
              statusColor = 'text-green-600'
            }

            return (
              <Card key={session.id} className="space-y-3 p-4">
                <span className="font-medium">
                  {session.class.shift === 'MORNING' ? 'AM' : 'PM'} Session
                </span>
                <p className={`text-sm font-medium ${statusColor}`}>
                  {statusText}
                </p>
                {!session.isClosed && (
                  <Link href={`/teacher/attendance/${session.id}`}>
                    <Button className="w-full" variant="outline">
                      Take Attendance
                    </Button>
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
