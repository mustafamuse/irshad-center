import { SessionCard } from '@/components/attendance/session-card'
import { Card } from '@/components/ui/card'
import { getTodaySessions } from '@/lib/db/queries/dugsi-attendance'
import { getNextWeekendDate, isWeekendDay } from '@/lib/utils/attendance-dates'

interface Props {
  teacherId?: string
  basePath: string
  ensureSessions?: () => Promise<unknown>
  getLabel: (session: {
    teacher: { person: { name: string } }
    class: { shift: string }
  }) => string
  emptyMessage?: string
}

export async function TodaySessionsList({
  teacherId,
  basePath,
  ensureSessions,
  getLabel,
  emptyMessage = 'No sessions found for today.',
}: Props) {
  const today = new Date()
  const isWeekend = isWeekendDay(today)

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

  if (ensureSessions) await ensureSessions()
  const sessions = await getTodaySessions(teacherId)

  if (sessions.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Today&apos;s Classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              sessionId={session.id}
              label={getLabel(session)}
              records={session.records}
              isClosed={session.isClosed}
              href={`${basePath}/${session.id}`}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
