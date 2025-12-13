'use server'

import {
  getClassAttendanceStats,
  DateRangeFilter,
} from '@/lib/db/queries/dugsi-attendance'
import { createActionLogger, logError } from '@/lib/logger'
import { getStudentStats } from '@/lib/services/dugsi/attendance-service'
import type {
  ClassAttendanceStats,
  StudentAttendanceStats,
} from '@/lib/types/dugsi-attendance'
import type { ActionResult } from '@/lib/utils/action-helpers'

const logger = createActionLogger('dugsi-attendance-reports')

export async function getClassStatsAction(
  classId: string,
  dateRange: DateRangeFilter
): Promise<ActionResult<ClassAttendanceStats>> {
  try {
    const stats = await getClassAttendanceStats(classId, dateRange)
    return { success: true, data: stats }
  } catch (error) {
    await logError(logger, error, 'Failed to get class stats')
    return { success: false, error: 'Failed to get class statistics' }
  }
}

export async function getStudentStatsAction(
  programProfileId: string,
  dateRange: DateRangeFilter
): Promise<ActionResult<StudentAttendanceStats>> {
  try {
    const stats = await getStudentStats(programProfileId, dateRange)
    return { success: true, data: stats }
  } catch (error) {
    await logError(logger, error, 'Failed to get student stats')
    return { success: false, error: 'Failed to get student statistics' }
  }
}

export async function getAllClassesStatsAction(
  classIds: string[],
  dateRange: DateRangeFilter
): Promise<ActionResult<ClassAttendanceStats[]>> {
  try {
    const statsPromises = classIds.map((id) =>
      getClassAttendanceStats(id, dateRange)
    )
    const stats = await Promise.all(statsPromises)
    return { success: true, data: stats }
  } catch (error) {
    await logError(logger, error, 'Failed to get all classes stats')
    return { success: false, error: 'Failed to get class statistics' }
  }
}
