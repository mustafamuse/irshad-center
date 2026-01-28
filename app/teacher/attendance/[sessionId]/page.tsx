import { notFound, redirect } from 'next/navigation'

import { addDays, endOfDay, isPast } from 'date-fns'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getEnrolledStudentsByClass,
  getSessionById,
} from '@/lib/db/queries/dugsi-attendance'
import { mapRecordsToMarkingDTOs } from '@/lib/mappers/attendance-mapper'

import { TeacherMarkAttendancePage } from './teacher-mark-attendance-page'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function TeacherAttendanceSessionPage({ params }: Props) {
  const teacherId = await getAuthenticatedTeacherId()
  const { sessionId } = await params

  const session = await getSessionById(sessionId)
  if (!session) notFound()

  if (session.teacherId !== teacherId) {
    redirect('/teacher/attendance')
  }

  const students = await getEnrolledStudentsByClass(session.classId)
  const attendance = mapRecordsToMarkingDTOs(session.records)

  const sessionDay = session.date.getDay()
  const sunday = sessionDay === 6 ? addDays(session.date, 1) : session.date
  const isEffectivelyClosed = session.isClosed || isPast(endOfDay(sunday))

  return (
    <TeacherMarkAttendancePage
      session={{
        id: session.id,
        date: session.date.toISOString(),
        isClosed: session.isClosed,
        className: session.class.name,
        shift: session.class.shift,
        teacherName: session.teacher.person.name,
      }}
      students={students}
      attendance={attendance}
      isEffectivelyClosed={isEffectivelyClosed}
    />
  )
}
