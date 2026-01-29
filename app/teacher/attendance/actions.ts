'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import { getSessionById } from '@/lib/db/queries/dugsi-attendance'
import { createActionLogger, logError } from '@/lib/logger'
import { markAttendanceRecords } from '@/lib/services/dugsi/attendance-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ActionResult } from '@/lib/utils/action-helpers'
import { MarkAttendanceSchema } from '@/lib/validations/attendance'

const logger = createActionLogger('teacher-attendance-actions')

export async function teacherMarkAttendance(
  input: unknown
): Promise<ActionResult<{ recordCount: number }>> {
  const parsed = MarkAttendanceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const [teacherId, session] = await Promise.all([
      getAuthenticatedTeacherId(),
      getSessionById(parsed.data.sessionId),
    ])
    if (!session || session.teacherId !== teacherId) {
      return {
        success: false,
        error: 'Unauthorized: session does not belong to you',
      }
    }

    const result = await markAttendanceRecords(parsed.data)
    revalidatePath('/teacher/attendance')
    revalidatePath('/admin/dugsi/attendance')
    revalidateTag('attendance-stats')
    revalidateTag('today-sessions')
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to mark attendance')
    return { success: false, error: 'Failed to mark attendance' }
  }
}
