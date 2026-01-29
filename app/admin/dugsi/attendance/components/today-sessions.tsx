import { TodaySessionsList } from '@/components/attendance/today-sessions-list'

import { ensureTodaySessions } from '../actions'

export async function TodaySessions() {
  return (
    <TodaySessionsList
      basePath="/admin/dugsi/attendance"
      ensureSessions={ensureTodaySessions}
      emptyMessage="No active classes found for today."
      getLabel={(session) =>
        `${session.teacher.person.name.split(' ')[0]} - ${session.class.shift === 'MORNING' ? 'AM' : 'PM'}`
      }
    />
  )
}
