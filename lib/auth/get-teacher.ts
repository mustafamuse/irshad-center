import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyTeacherAuthToken } from './teacher-auth'

export async function getAuthenticatedTeacherId(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get('teacher_auth')?.value

  if (!token) {
    redirect('/teacher/login')
  }

  const result = verifyTeacherAuthToken(token)
  if (!result) {
    redirect('/teacher/login')
  }

  return result.teacherId
}
