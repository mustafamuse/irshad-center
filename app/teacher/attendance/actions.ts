'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getSessionById,
  fetchTodaySessionsForList,
} from '@/lib/db/queries/dugsi-attendance'
import { getTeacherClassIds } from '@/lib/db/queries/teacher-students'
import { createActionLogger, logError } from '@/lib/logger'
import {
  createAttendanceSession,
  markAttendanceRecords,
  ATTENDANCE_ERROR_CODES,
} from '@/lib/services/dugsi/attendance-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ActionResult } from '@/lib/utils/action-helpers'
import { getLocalDay, getLocalDateString } from '@/lib/utils/attendance-dates'
import { MarkAttendanceSchema } from '@/lib/validations/attendance'

const logger = createActionLogger('teacher-attendance-actions')

export async function ensureTeacherTodaySessions(): Promise<void> {
  try {
    const day = getLocalDay()
    if (day !== 0 && day !== 6) return

    const teacherId = await getAuthenticatedTeacherId()
    const classIds = await getTeacherClassIds(teacherId)
    if (classIds.length === 0) return

    const existingSessions = await fetchTodaySessionsForList()
    const existingClassIds = new Set(existingSessions.map((s) => s.classId))
    const missing = classIds.filter((id) => !existingClassIds.has(id))
    if (missing.length === 0) return

    const dateOnly = new Date(getLocalDateString())
    const results = await Promise.allSettled(
      missing.map((classId) =>
        createAttendanceSession({ classId, date: dateOnly })
      )
    )

    const acceptableCodes: Set<string> = new Set([
      ATTENDANCE_ERROR_CODES.DUPLICATE_SESSION,
      ATTENDANCE_ERROR_CODES.NO_TEACHER_ASSIGNED,
    ])
    const realFailures = results.filter(
      (r): r is PromiseRejectedResult =>
        r.status === 'rejected' &&
        !(
          r.reason instanceof ValidationError &&
          acceptableCodes.has(r.reason.code)
        )
    )

    if (realFailures.length > 0) {
      await logError(
        logger,
        new Error(
          `${realFailures.length}/${results.length} teacher session creations failed`
        ),
        'Partial failure in ensureTeacherTodaySessions'
      )
    }

    revalidateTag('today-sessions')
    revalidatePath('/teacher/attendance')
  } catch (error) {
    if (isRedirectError(error)) throw error
    await logError(logger, error, 'Failed to ensure teacher today sessions')
  }
}

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
