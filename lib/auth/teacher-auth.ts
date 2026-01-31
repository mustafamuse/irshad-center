import crypto from 'crypto'

import { findTeachersByPhoneLastFour } from '@/lib/db/queries/teacher'

const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000

export async function authenticateTeacher(
  lastFour: string
): Promise<{ teacherId: string; teacherName: string } | null> {
  const teachers = await findTeachersByPhoneLastFour(lastFour)

  if (teachers.length !== 1) return null

  return { teacherId: teachers[0].id, teacherName: teachers[0].person.name }
}

export function generateTeacherAuthToken(teacherId: string): string {
  const timestamp = Date.now().toString()
  const secret = process.env.TEACHER_AUTH_SECRET
  if (!secret)
    throw new Error('TEACHER_AUTH_SECRET environment variable is required')
  const data = `${teacherId}.${timestamp}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
  return `${teacherId}.${timestamp}.${signature}`
}

export function verifyTeacherAuthToken(
  token: string
): { teacherId: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [teacherId, timestamp, signature] = parts
    if (!teacherId || !timestamp || !signature) return null

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > MAX_TOKEN_AGE_MS || tokenAge < 0) {
      return null
    }

    const secret = process.env.TEACHER_AUTH_SECRET
    if (!secret)
      throw new Error('TEACHER_AUTH_SECRET environment variable is required')
    const data = `${teacherId}.${timestamp}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )

    return isValid ? { teacherId } : null
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('TEACHER_AUTH_SECRET')
    ) {
      throw error
    }
    return null
  }
}
