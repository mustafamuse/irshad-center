import { notFound, redirect } from 'next/navigation'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getEnrolledStudentsByClass,
  getSessionById,
} from '@/lib/db/queries/dugsi-attendance'
import { isSessionEffectivelyClosed } from '@/lib/utils/attendance-dates'

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
  const attendance = session.records

  const isEffectivelyClosed = isSessionEffectivelyClosed(
    session.date,
    session.isClosed
  )

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
