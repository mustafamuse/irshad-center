import { TodaySessionsList } from '@/components/attendance/today-sessions-list'

interface Props {
  teacherId: string
}

export async function TeacherTodaySessions({ teacherId }: Props) {
  return (
    <TodaySessionsList
      teacherId={teacherId}
      basePath="/teacher/attendance"
      getLabel={(session) =>
        `${session.class.shift === 'MORNING' ? 'AM' : 'PM'} Session`
      }
    />
  )
}
