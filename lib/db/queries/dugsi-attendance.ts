import { DugsiAttendanceStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import type { DatabaseClient } from '@/lib/db/types'
import type { ClassAttendanceStats } from '@/lib/types/dugsi-attendance'

export interface DateRangeFilter {
  startDate?: Date
  endDate?: Date
}

export async function getSessionsByClass(
  classId: string,
  dateRange: DateRangeFilter = {},
  client: DatabaseClient = prisma
) {
  const { startDate, endDate } = dateRange

  const dateFilter = {} as { gte?: Date; lte?: Date }
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  return client.dugsiAttendanceSession.findMany({
    where: {
      classId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    include: {
      class: { select: { name: true } },
      teacher: { include: { person: { select: { name: true } } } },
      _count: { select: { records: true } },
    },
    orderBy: { date: 'desc' },
  })
}

export async function getTodaysSessionForClass(
  classId: string,
  client: DatabaseClient = prisma
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return client.dugsiAttendanceSession.findUnique({
    where: {
      date_classId: { date: today, classId },
    },
    include: {
      records: {
        include: {
          profile: {
            include: { person: { select: { name: true } } },
          },
        },
      },
    },
  })
}

export async function getAttendanceRecordsBySession(
  sessionId: string,
  client: DatabaseClient = prisma
) {
  return client.dugsiAttendanceRecord.findMany({
    where: { sessionId },
    include: {
      profile: {
        include: { person: { select: { name: true } } },
      },
    },
    orderBy: { profile: { person: { name: 'asc' } } },
  })
}

export async function getStudentAttendanceHistory(
  programProfileId: string,
  dateRange: DateRangeFilter = {},
  client: DatabaseClient = prisma
) {
  const { startDate, endDate } = dateRange

  const dateFilter = {} as { gte?: Date; lte?: Date }
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  return client.dugsiAttendanceRecord.findMany({
    where: {
      programProfileId,
      ...(Object.keys(dateFilter).length > 0 && {
        session: {
          date: dateFilter,
        },
      }),
    },
    include: {
      session: {
        include: { class: { select: { name: true } } },
      },
    },
    orderBy: { session: { date: 'desc' } },
  })
}

export async function getClassAttendanceStats(
  classId: string,
  dateRange: DateRangeFilter,
  client: DatabaseClient = prisma
): Promise<ClassAttendanceStats> {
  const { startDate, endDate } = dateRange

  const dateFilter = {} as { gte?: Date; lte?: Date }
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
    select: { name: true },
  })

  const sessions = await client.dugsiAttendanceSession.findMany({
    where: {
      classId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    select: { id: true },
  })

  const totalSessions = sessions.length

  if (totalSessions === 0) {
    return {
      classId,
      className: dugsiClass?.name || '',
      totalSessions: 0,
      averageAttendanceRate: 0,
      averageLessonCompletionRate: 0,
    }
  }

  const records = await client.dugsiAttendanceRecord.findMany({
    where: {
      session: {
        classId,
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
    },
  })

  const totalRecords = records.length
  const presentOrLate = records.filter(
    (r) =>
      r.status === DugsiAttendanceStatus.PRESENT ||
      r.status === DugsiAttendanceStatus.LATE
  ).length
  const lessonsCompleted = records.filter(
    (r) =>
      (r.status === DugsiAttendanceStatus.PRESENT ||
        r.status === DugsiAttendanceStatus.LATE) &&
      r.lessonCompleted
  ).length

  const averageAttendanceRate =
    totalRecords > 0 ? Math.round((presentOrLate / totalRecords) * 100) : 0
  const averageLessonCompletionRate =
    presentOrLate > 0 ? Math.round((lessonsCompleted / presentOrLate) * 100) : 0

  return {
    classId,
    className: dugsiClass?.name || '',
    totalSessions,
    averageAttendanceRate,
    averageLessonCompletionRate,
  }
}
