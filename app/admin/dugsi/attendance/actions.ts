'use server'

import { revalidatePath } from 'next/cache'

import { DugsiAttendanceStatus } from '@prisma/client'

import {
  getSessionsByClass,
  getTodaysSessionForClass,
  getAttendanceRecordsBySession,
  getClassAttendanceStats,
} from '@/lib/db/queries/dugsi-attendance'
import { createActionLogger } from '@/lib/logger'
import {
  createAttendanceSession,
  markAttendance,
  closeSession,
  getStudentStats,
} from '@/lib/services/dugsi/attendance-service'
import type {
  AttendanceSessionDTO,
  AttendanceRecordDTO,
  StudentAttendanceStats,
  ClassAttendanceStats,
} from '@/lib/types/dugsi-attendance'
import { ActionResult, handleActionError } from '@/lib/utils/action-helpers'
import { PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  CreateSessionSchema,
  MarkAttendanceSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createActionLogger('dugsi-attendance')

function mapSessionToDTO(
  session: Awaited<ReturnType<typeof getSessionsByClass>>[0]
): AttendanceSessionDTO {
  return {
    id: session.id,
    date: session.date,
    classId: session.classId,
    className: session.class.name,
    teacherId: session.teacherId,
    teacherName: session.teacher.person.name,
    notes: session.notes,
    isClosed: session.isClosed,
    recordCount: session._count.records,
    presentCount: 0,
    absentCount: 0,
  }
}

export async function getSessionsForClassAction(
  classId: string,
  dateRange?: { startDate?: Date; endDate?: Date }
): Promise<ActionResult<AttendanceSessionDTO[]>> {
  try {
    const sessions = await getSessionsByClass(classId, dateRange)
    const dtos = sessions.map(mapSessionToDTO)
    return { success: true, data: dtos }
  } catch (error) {
    return handleActionError(error, 'getSessionsForClassAction', logger)
  }
}

export async function getTodaysSessionAction(
  classId: string
): Promise<ActionResult<AttendanceSessionDTO | null>> {
  try {
    const session = await getTodaysSessionForClass(classId)
    if (!session) {
      return { success: true, data: null }
    }

    const presentCount = session.records.filter(
      (r) =>
        r.status === DugsiAttendanceStatus.PRESENT ||
        r.status === DugsiAttendanceStatus.LATE
    ).length
    const absentCount = session.records.filter(
      (r) => r.status === DugsiAttendanceStatus.ABSENT
    ).length

    return {
      success: true,
      data: {
        id: session.id,
        date: session.date,
        classId: session.classId,
        className: '',
        teacherId: session.teacherId,
        teacherName: '',
        notes: session.notes,
        isClosed: session.isClosed,
        recordCount: session.records.length,
        presentCount,
        absentCount,
      },
    }
  } catch (error) {
    return handleActionError(error, 'getTodaysSessionAction', logger)
  }
}

export async function getAttendanceRecordsAction(
  sessionId: string
): Promise<ActionResult<AttendanceRecordDTO[]>> {
  try {
    const records = await getAttendanceRecordsBySession(sessionId)
    const dtos: AttendanceRecordDTO[] = records.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      programProfileId: r.programProfileId,
      studentName: r.profile.person.name,
      status: r.status,
      lessonCompleted: r.lessonCompleted,
      surahName: r.surahName,
      ayatFrom: r.ayatFrom,
      ayatTo: r.ayatTo,
      lessonNotes: r.lessonNotes,
      notes: r.notes,
      markedAt: r.markedAt,
    }))
    return { success: true, data: dtos }
  } catch (error) {
    return handleActionError(error, 'getAttendanceRecordsAction', logger)
  }
}

export async function createSessionAction(data: {
  classId: string
  teacherId: string
  date?: Date
  notes?: string
}): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const validated = CreateSessionSchema.parse(data)
    const session = await createAttendanceSession(validated)

    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: { sessionId: session.id },
    }
  } catch (error) {
    return handleActionError(error, 'createSessionAction', logger, {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]:
          'A session already exists for this class on this date',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid class or teacher reference',
      },
    })
  }
}

export async function markAttendanceAction(data: {
  sessionId: string
  records: Array<{
    programProfileId: string
    status: DugsiAttendanceStatus
    lessonCompleted?: boolean
    surahName?: string
    ayatFrom?: number
    ayatTo?: number
    lessonNotes?: string
    notes?: string
  }>
}): Promise<ActionResult<{ markedCount: number }>> {
  try {
    const validated = MarkAttendanceSchema.parse(data)
    const result = await markAttendance(validated)

    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return handleActionError(error, 'markAttendanceAction', logger, {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Session not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]: 'Invalid student reference',
      },
    })
  }
}

export async function closeSessionAction(
  sessionId: string
): Promise<ActionResult> {
  try {
    await closeSession(sessionId)

    revalidatePath('/admin/dugsi/attendance')

    return { success: true }
  } catch (error) {
    return handleActionError(error, 'closeSessionAction', logger, {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Session not found',
      },
    })
  }
}

export async function getStudentStatsAction(
  programProfileId: string,
  dateRange?: { startDate?: Date; endDate?: Date }
): Promise<ActionResult<StudentAttendanceStats>> {
  try {
    const stats = await getStudentStats(programProfileId, dateRange || {})
    return { success: true, data: stats }
  } catch (error) {
    return handleActionError(error, 'getStudentStatsAction', logger)
  }
}

export async function getClassStatsAction(
  classId: string,
  dateRange?: { startDate?: Date; endDate?: Date }
): Promise<ActionResult<ClassAttendanceStats>> {
  try {
    const stats = await getClassAttendanceStats(classId, dateRange || {})
    return { success: true, data: stats }
  } catch (error) {
    return handleActionError(error, 'getClassStatsAction', logger)
  }
}
