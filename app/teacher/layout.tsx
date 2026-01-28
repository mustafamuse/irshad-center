import { cookies } from 'next/headers'

import { verifyTeacherAuthToken } from '@/lib/auth/teacher-auth'
import { prisma } from '@/lib/db'

import { TeacherHeader } from './components/teacher-header'

async function getTeacherName(teacherId: string): Promise<string> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { person: { select: { name: true } } },
  })
  return teacher?.person.name ?? 'Teacher'
}

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('teacher_auth')?.value
  const result = token ? verifyTeacherAuthToken(token) : null
  const teacherName = result ? await getTeacherName(result.teacherId) : null

  return (
    <div className="min-h-screen bg-background">
      {teacherName && <TeacherHeader teacherName={teacherName} />}
      <main>{children}</main>
    </div>
  )
}
