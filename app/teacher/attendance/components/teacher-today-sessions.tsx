import { TodaySessionsList } from '@/components/attendance/today-sessions-list'
import { SHIFT_SHORT_LABEL } from '@/lib/constants/dugsi'

interface Props {
  teacherId: string
}

export async function TeacherTodaySessions({ teacherId }: Props) {
  return (
    <TodaySessionsList
      teacherId={teacherId}
      basePath="/teacher/attendance"
      getLabel={(session) =>
        `${SHIFT_SHORT_LABEL[session.class.shift as keyof typeof SHIFT_SHORT_LABEL]} Session`
      }
    />
  )
}
