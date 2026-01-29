'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/get-admin'
import {
  getActiveClasses,
  getAttendanceStats,
  getEnrolledStudentsByClass,
  getSessions,
  fetchTodaySessionsForList,
  type AttendanceStats,
  type PaginatedSessions,
} from '@/lib/db/queries/dugsi-attendance'
import { createActionLogger, logError } from '@/lib/logger'
import {
  createAttendanceSession,
  deleteAttendanceSession,
  markAttendanceRecords,
} from '@/lib/services/dugsi/attendance-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ActionResult } from '@/lib/utils/action-helpers'
import {
  AttendanceFiltersSchema,
  CreateSessionSchema,
  DeleteSessionSchema,
  MarkAttendanceSchema,
} from '@/lib/validations/attendance'

const logger = createActionLogger('attendance-actions')

const REVALIDATE_PATH = '/admin/dugsi/attendance'

function revalidateAttendance() {
  revalidatePath(REVALIDATE_PATH)
  revalidateTag('attendance-stats')
  revalidateTag('today-sessions')
}

export type ClassOption = { id: string; name: string; shift: string }
export type StudentOption = { programProfileId: string; name: string }

export async function createSession(
  input: unknown
): Promise<ActionResult<{ sessionId: string }>> {
  await requireAdmin()
  const parsed = CreateSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const { session } = await createAttendanceSession(parsed.data)
    revalidateAttendance()
    return { success: true, data: { sessionId: session.id } }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to create session')
    return { success: false, error: 'Failed to create session' }
  }
}

export async function markAttendance(
  input: unknown
): Promise<ActionResult<{ recordCount: number }>> {
  await requireAdmin()
  const parsed = MarkAttendanceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const result = await markAttendanceRecords(parsed.data)
    revalidateAttendance()
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to mark attendance')
    return { success: false, error: 'Failed to mark attendance' }
  }
}

export async function deleteSession(
  input: unknown
): Promise<ActionResult<void>> {
  await requireAdmin()
  const parsed = DeleteSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await deleteAttendanceSession(parsed.data.sessionId)
    revalidateAttendance()
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to delete session')
    return { success: false, error: 'Failed to delete session' }
  }
}

export async function getSessionsAction(
  input: unknown
): Promise<ActionResult<PaginatedSessions>> {
  await requireAdmin()
  const parsed = AttendanceFiltersSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const { page, limit, ...filters } = parsed.data
    const result = await getSessions(filters, { page, limit })
    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch sessions')
    return { success: false, error: 'Failed to fetch sessions' }
  }
}

export async function getAttendanceStatsAction(): Promise<
  ActionResult<AttendanceStats>
> {
  await requireAdmin()
  try {
    const stats = await getAttendanceStats()
    return { success: true, data: stats }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch attendance stats')
    return { success: false, error: 'Failed to fetch attendance stats' }
  }
}

export async function getClassesForDropdownAction(): Promise<
  ActionResult<ClassOption[]>
> {
  await requireAdmin()
  try {
    const classes = await getActiveClasses()
    return {
      success: true,
      data: classes.map((c) => ({ id: c.id, name: c.name, shift: c.shift })),
    }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch classes')
    return { success: false, error: 'Failed to fetch classes' }
  }
}

export async function ensureTodaySessions(): Promise<ActionResult<void>> {
  await requireAdmin()
  const now = Date.now()
  const utcDay = new Date(now).getUTCDay()
  if (utcDay !== 0 && utcDay !== 6) return { success: true, data: undefined }

  try {
    const dateOnly = new Date(new Date(now).toISOString().split('T')[0])
    const [classes, existingSessions] = await Promise.all([
      getActiveClasses(),
      fetchTodaySessionsForList(),
    ])
    const existingClassIds = new Set(existingSessions.map((s) => s.classId))
    const missing = classes.filter((c) => !existingClassIds.has(c.id))

    if (missing.length === 0) {
      return { success: true, data: undefined }
    }

    const results = await Promise.allSettled(
      missing.map((c) =>
        createAttendanceSession({ classId: c.id, date: dateOnly })
      )
    )
    const realFailures = results.filter(
      (r): r is PromiseRejectedResult =>
        r.status === 'rejected' &&
        !(
          r.reason instanceof ValidationError &&
          r.reason.code === 'DUPLICATE_SESSION'
        )
    )
    if (realFailures.length > 0) {
      await logError(
        logger,
        new Error(
          `${realFailures.length}/${results.length} session creations failed: ${realFailures.map((f) => (f.reason as Error).message).join('; ')}`
        ),
        'Partial failure in ensureTodaySessions'
      )
      revalidateAttendance()
      return {
        success: false,
        error: `${realFailures.length} of ${results.length} sessions failed to create`,
      }
    }
    revalidateAttendance()
    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to ensure today sessions')
    return { success: false, error: 'Failed to create today sessions' }
  }
}

export async function getStudentsForClassAction(
  classId: string
): Promise<ActionResult<StudentOption[]>> {
  await requireAdmin()
  const parsed = z.string().uuid('Invalid class ID').safeParse(classId)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const students = await getEnrolledStudentsByClass(parsed.data)
    return { success: true, data: students }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch students')
    return { success: false, error: 'Failed to fetch students' }
  }
}
