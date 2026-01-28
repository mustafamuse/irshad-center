import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getTodaySessions } from '@/lib/db/queries/dugsi-attendance'

import { ensureTodaySessions } from '../actions'

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

export async function TodaySessions() {
  const today = new Date()
  const isWeekend = today.getDay() === 0 || today.getDay() === 6

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

  await ensureTodaySessions()
  const sessions = await getTodaySessions(undefined)

  if (sessions.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          No active classes found for today.
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
            const markedCount = session.records.length
            const presentCount = session.records.filter(
              (r) => r.status === 'PRESENT' || r.status === 'LATE'
            ).length

            let statusText: string
            let statusColor: string
            if (markedCount === 0) {
              statusText = 'Not started'
              statusColor = 'text-muted-foreground'
            } else {
              statusText = `${presentCount}/${totalStudents} present`
              statusColor = 'text-green-600'
            }

            return (
              <Card key={session.id} className="space-y-3 p-4">
                <span className="font-medium">
                  {session.teacher.person.name.split(' ')[0]} -{' '}
                  {session.class.shift === 'MORNING' ? 'AM' : 'PM'}
                </span>
                <p className={`text-sm font-medium ${statusColor}`}>
                  {statusText}
                </p>
                {!session.isClosed && (
                  <Link href={`/admin/dugsi/attendance/${session.id}`}>
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
