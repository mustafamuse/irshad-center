'use server'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getTeacherClassIds,
  getStudentProfile,
  getStudentAttendanceRecords,
} from '@/lib/db/queries/teacher-students'
import { createActionLogger, logError } from '@/lib/logger'
import type { SessionHistoryItem } from '@/lib/mappers/teacher-student-mapper'
import type { ActionResult } from '@/lib/utils/action-helpers'
import { LoadMoreHistorySchema } from '@/lib/validations/attendance'

const logger = createActionLogger('teacher-student-actions')

interface LoadMoreResult {
  data: SessionHistoryItem[]
  hasMore: boolean
}

export async function loadMoreStudentHistory(
  profileId: string,
  offset: number
): Promise<ActionResult<LoadMoreResult>> {
  const parsed = LoadMoreHistorySchema.safeParse({ profileId, offset })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const teacherId = await getAuthenticatedTeacherId()

    const student = await getStudentProfile(parsed.data.profileId)
    if (!student) {
      return { success: false, error: 'Student not found in your classes' }
    }

    const classIds = await getTeacherClassIds(teacherId)
    if (!classIds.includes(student.classId)) {
      return { success: false, error: 'Student not found in your classes' }
    }

    const result = await getStudentAttendanceRecords(parsed.data.profileId, {
      offset: parsed.data.offset,
      limit: 20,
    })
    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Failed to load student history', {
      profileId: parsed.data.profileId,
    })
    return { success: false, error: 'Failed to load attendance history' }
  }
}
