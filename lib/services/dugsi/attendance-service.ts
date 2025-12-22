import { DugsiAttendanceStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import type { DateRangeFilter } from '@/lib/db/queries/dugsi-attendance'
import { getStudentAttendanceHistory } from '@/lib/db/queries/dugsi-attendance'
import type { DatabaseClient } from '@/lib/db/types'
import {
  ActionError,
  ERROR_CODES,
  notFoundError,
} from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import type {
  CreateSessionInput,
  MarkAttendanceInput,
  StudentAttendanceStats,
} from '@/lib/types/dugsi-attendance'
import { isPrismaError, PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  CreateSessionSchema,
  MarkAttendanceSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createServiceLogger('dugsi-attendance-service')

export async function createAttendanceSession(
  input: CreateSessionInput,
  client: DatabaseClient = prisma
) {
  const validated = CreateSessionSchema.parse(input)
  const { classId, teacherId, date, notes } = validated

  const sessionDate = date || new Date()
  sessionDate.setHours(0, 0, 0, 0)

  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
  })

  if (!dugsiClass) {
    throw notFoundError('Class', ERROR_CODES.NOT_FOUND)
  }

  if (!dugsiClass.isActive) {
    throw new ActionError('Class is not active', ERROR_CODES.VALIDATION_ERROR)
  }

  logger.info(
    { classId, teacherId, date: sessionDate },
    'Creating attendance session'
  )

  try {
    const session = await client.dugsiAttendanceSession.create({
      data: {
        date: sessionDate,
        classId,
        teacherId,
        notes,
      },
    })

    logger.info({ sessionId: session.id }, 'Attendance session created')

    return session
  } catch (error) {
    if (
      isPrismaError(error) &&
      error.code === PRISMA_ERRORS.UNIQUE_CONSTRAINT
    ) {
      throw new ActionError(
        'Attendance session already exists for this class on this date',
        ERROR_CODES.VALIDATION_ERROR
      )
    }
    await logError(logger, error, 'Failed to create attendance session', {
      classId,
      teacherId,
      date: sessionDate,
    })
    throw error
  }
}

export async function markAttendance(input: MarkAttendanceInput) {
  const validated = MarkAttendanceSchema.parse(input)
  const { sessionId, records } = validated

  return prisma.$transaction(async (tx) => {
    const session = await tx.dugsiAttendanceSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw notFoundError('Session', ERROR_CODES.NOT_FOUND)
    }

    if (session.isClosed) {
      throw new ActionError(
        'Cannot mark attendance for a closed session',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    const classEnrollments = await tx.dugsiClassEnrollment.findMany({
      where: {
        classId: session.classId,
        isActive: true,
      },
      select: {
        programProfileId: true,
      },
    })

    const enrolledProfileIds = new Set(
      classEnrollments.map(
        (e: { programProfileId: string }) => e.programProfileId
      )
    )

    const invalidProfiles = records.filter(
      (r: { programProfileId: string }) =>
        !enrolledProfileIds.has(r.programProfileId)
    )

    if (invalidProfiles.length > 0) {
      throw new ActionError(
        `Students not enrolled in this class: ${invalidProfiles.map((r) => r.programProfileId).join(', ')}`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    logger.info(
      { sessionId, recordCount: records.length },
      'Marking attendance for session'
    )

    for (const record of records) {
      await tx.dugsiAttendanceRecord.upsert({
        where: {
          sessionId_programProfileId: {
            sessionId,
            programProfileId: record.programProfileId,
          },
        },
        create: {
          sessionId,
          programProfileId: record.programProfileId,
          status: record.status,
          lessonCompleted: record.lessonCompleted || false,
          surahName: record.surahName,
          ayatFrom: record.ayatFrom,
          ayatTo: record.ayatTo,
          lessonNotes: record.lessonNotes,
          notes: record.notes,
        },
        update: {
          status: record.status,
          lessonCompleted: record.lessonCompleted || false,
          surahName: record.surahName,
          ayatFrom: record.ayatFrom,
          ayatTo: record.ayatTo,
          lessonNotes: record.lessonNotes,
          notes: record.notes,
          markedAt: new Date(),
        },
      })
    }

    logger.info(
      { sessionId, markedCount: records.length },
      'Attendance marking completed'
    )

    return { markedCount: records.length }
  })
}

export async function closeSession(
  sessionId: string,
  client: DatabaseClient = prisma
) {
  const session = await client.dugsiAttendanceSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    throw notFoundError('Session', ERROR_CODES.NOT_FOUND)
  }

  if (session.isClosed) {
    throw new ActionError(
      'Session is already closed',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  logger.info({ sessionId }, 'Closing attendance session')

  return client.dugsiAttendanceSession.update({
    where: { id: sessionId },
    data: { isClosed: true },
  })
}

export async function getStudentStats(
  programProfileId: string,
  dateRange: DateRangeFilter,
  client: DatabaseClient = prisma
): Promise<StudentAttendanceStats> {
  const records = await getStudentAttendanceHistory(
    programProfileId,
    dateRange,
    client
  )

  const totalSessions = records.length
  const presentCount = records.filter(
    (r) => r.status === DugsiAttendanceStatus.PRESENT
  ).length
  const absentCount = records.filter(
    (r) => r.status === DugsiAttendanceStatus.ABSENT
  ).length
  const lateCount = records.filter(
    (r) => r.status === DugsiAttendanceStatus.LATE
  ).length
  const excusedCount = records.filter(
    (r) => r.status === DugsiAttendanceStatus.EXCUSED
  ).length

  const presentOrLateCount = presentCount + lateCount
  const attendanceRate =
    totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0

  const lessonsCompleted = records.filter(
    (r) =>
      (r.status === DugsiAttendanceStatus.PRESENT ||
        r.status === DugsiAttendanceStatus.LATE) &&
      r.lessonCompleted
  ).length

  const lessonCompletionRate =
    presentOrLateCount > 0 ? (lessonsCompleted / presentOrLateCount) * 100 : 0

  return {
    programProfileId,
    studentName: '',
    totalSessions,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate: Math.round(attendanceRate),
    lessonCompletionRate: Math.round(lessonCompletionRate),
  }
}
