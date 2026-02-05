import { TodaySessionsList } from '@/components/attendance/today-sessions-list'
import { SHIFT_SHORT_LABEL } from '@/lib/constants/dugsi'

import { ensureTodaySessions } from '../actions'

export async function TodaySessions() {
  return (
    <TodaySessionsList
      basePath="/admin/dugsi/attendance"
      ensureSessions={ensureTodaySessions}
      emptyMessage="No active classes found for today."
      getLabel={(session) =>
        `${session.teacher.person.name.split(' ')[0]} - ${SHIFT_SHORT_LABEL[session.class.shift as keyof typeof SHIFT_SHORT_LABEL]}`
      }
    />
  )
}
