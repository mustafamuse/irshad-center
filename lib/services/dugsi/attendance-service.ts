import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  getSessionById,
  attendanceSessionInclude,
  AttendanceSessionWithRelations,
} from '@/lib/db/queries/dugsi-attendance'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import { ValidationError } from '@/lib/services/validation-service'
import { isSessionEffectivelyClosed } from '@/lib/utils/attendance-dates'
import {
  CreateSessionSchema,
  MarkAttendanceSchema,
} from '@/lib/validations/attendance'
import type {
  CreateSessionInput,
  MarkAttendanceInput,
} from '@/lib/validations/attendance'

const logger = createServiceLogger('attendance')

export const ATTENDANCE_ERROR_CODES = {
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_CLOSED: 'SESSION_CLOSED',
  DUPLICATE_SESSION: 'DUPLICATE_SESSION',
  NO_TEACHER_ASSIGNED: 'NO_TEACHER_ASSIGNED',
  INVALID_DAY: 'INVALID_DAY',
} as const

export interface CreateSessionResult {
  session: AttendanceSessionWithRelations
}

export interface MarkAttendanceResult {
  recordCount: number
}

export async function createAttendanceSession(
  input: CreateSessionInput,
  client: DatabaseClient = prisma
): Promise<CreateSessionResult> {
  const validated = CreateSessionSchema.parse(input)
  const { classId, date, notes } = validated
  const dateOnly = new Date(date.toISOString().split('T')[0])

  const day = dateOnly.getUTCDay()
  if (day !== 0 && day !== 6) {
    throw new ValidationError(
      'Dugsi sessions can only be created on weekends (Saturday or Sunday)',
      ATTENDANCE_ERROR_CODES.INVALID_DAY,
      { classId, date: dateOnly.toISOString() }
    )
  }

  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
    include: {
      teachers: {
        where: { isActive: true },
        select: { teacherId: true },
        take: 1,
      },
    },
  })

  if (!dugsiClass) {
    throw new ValidationError(
      'Class not found',
      ATTENDANCE_ERROR_CODES.CLASS_NOT_FOUND,
      { classId }
    )
  }

  if (dugsiClass.teachers.length === 0) {
    throw new ValidationError(
      'No active teacher assigned to this class',
      ATTENDANCE_ERROR_CODES.NO_TEACHER_ASSIGNED,
      { classId }
    )
  }

  const teacherId = dugsiClass.teachers[0].teacherId

  let session: AttendanceSessionWithRelations

  try {
    session = await client.dugsiAttendanceSession.create({
      data: {
        classId,
        date: dateOnly,
        teacherId,
        notes: notes ?? null,
      },
      include: attendanceSessionInclude,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ValidationError(
        'A session already exists for this class on this date',
        ATTENDANCE_ERROR_CODES.DUPLICATE_SESSION,
        { classId, date: dateOnly.toISOString() }
      )
    }
    throw error
  }

  logger.info(
    {
      event: 'SESSION_CREATED',
      sessionId: session.id,
      classId,
      teacherId,
      date: dateOnly.toISOString(),
    },
    'Attendance session created'
  )

  return { session }
}

export async function markAttendanceRecords(
  input: MarkAttendanceInput,
  client: DatabaseClient = prisma
): Promise<MarkAttendanceResult> {
  const validated = MarkAttendanceSchema.parse(input)
  const { sessionId, records } = validated

  const verifyAndUpsert = async (tx: DatabaseClient) => {
    const session = await getSessionById(sessionId, tx)
    if (!session) {
      throw new ValidationError(
        'Session not found',
        ATTENDANCE_ERROR_CODES.SESSION_NOT_FOUND,
        { sessionId }
      )
    }

    if (isSessionEffectivelyClosed(new Date(session.date), session.isClosed)) {
      throw new ValidationError(
        'Cannot modify a closed session',
        ATTENDANCE_ERROR_CODES.SESSION_CLOSED,
        { sessionId }
      )
    }

    await Promise.all(
      records.map((record) => {
        const data = {
          status: record.status,
          lessonCompleted: record.lessonCompleted ?? false,
          surahName: record.surahName ?? null,
          ayatFrom: record.ayatFrom ?? null,
          ayatTo: record.ayatTo ?? null,
          lessonNotes: record.lessonNotes ?? null,
          notes: record.notes ?? null,
          markedAt: new Date(),
        }
        return tx.dugsiAttendanceRecord.upsert({
          where: {
            sessionId_programProfileId: {
              sessionId,
              programProfileId: record.programProfileId,
            },
          },
          create: {
            sessionId,
            programProfileId: record.programProfileId,
            ...data,
          },
          update: data,
        })
      })
    )
  }

  if (isPrismaClient(client)) {
    await client.$transaction(async (tx) => verifyAndUpsert(tx))
  } else {
    await verifyAndUpsert(client)
  }

  logger.info(
    {
      event: 'ATTENDANCE_MARKED',
      sessionId,
      recordCount: records.length,
    },
    `Marked attendance for ${records.length} students`
  )

  return { recordCount: records.length }
}

export async function deleteAttendanceSession(
  sessionId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  const session = await getSessionById(sessionId, client)
  if (!session) {
    throw new ValidationError(
      'Session not found',
      ATTENDANCE_ERROR_CODES.SESSION_NOT_FOUND,
      { sessionId }
    )
  }

  await client.dugsiAttendanceSession.delete({
    where: { id: sessionId },
  })

  logger.info(
    {
      event: 'SESSION_DELETED',
      sessionId,
      classId: session.classId,
      date: session.date.toISOString(),
    },
    'Attendance session deleted'
  )
}
