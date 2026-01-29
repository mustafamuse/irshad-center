import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-admin'
import {
  getEnrolledStudentsByClass,
  getSessionById,
} from '@/lib/db/queries/dugsi-attendance'

import { MarkAttendancePage } from './mark-attendance-page'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function AttendanceSessionPage({ params }: Props) {
  await requireAdmin()
  const { sessionId } = await params

  const session = await getSessionById(sessionId)
  if (!session) notFound()

  const students = await getEnrolledStudentsByClass(session.classId)
  const attendance = session.records

  return (
    <MarkAttendancePage
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
    />
  )
}
