import { cookies } from 'next/headers'

import { verifyTeacherAuthToken } from '@/lib/auth/teacher-auth'
import { getTeacherName } from '@/lib/db/queries/teacher'

import { TeacherHeader } from './components/teacher-header'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('teacher_auth')?.value
  const result = token ? verifyTeacherAuthToken(token) : null
  const teacherName = result
    ? ((await getTeacherName(result.teacherId)) ?? 'Teacher')
    : null

  return (
    <div className="min-h-screen bg-background">
      {teacherName && <TeacherHeader teacherName={teacherName} />}
      <main>{children}</main>
    </div>
  )
}
