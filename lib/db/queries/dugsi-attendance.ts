import { unstable_cache } from 'next/cache'

import { Prisma, Shift } from '@prisma/client'

import { DEFAULT_QUERY_LIMIT } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { getLocalDateString } from '@/lib/utils/attendance-dates'
import {
  sortByFamilyThenName,
  aggregateStatusCounts,
  rateFromStatusCounts,
} from '@/lib/utils/attendance-math'

function buildDateFilter(
  dateFrom?: Date,
  dateTo?: Date
): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined
  const filter: Prisma.DateTimeFilter = {}
  if (dateFrom) filter.gte = new Date(getLocalDateString(dateFrom))
  if (dateTo) filter.lte = new Date(getLocalDateString(dateTo))
  return filter
}

export const attendanceSessionInclude = {
  class: true,
  teacher: {
    include: {
      person: true,
    },
  },
  records: {
    include: {
      profile: {
        include: {
          person: true,
        },
      },
    },
  },
} as const satisfies Prisma.DugsiAttendanceSessionInclude

export type AttendanceSessionWithRelations =
  Prisma.DugsiAttendanceSessionGetPayload<{
    include: typeof attendanceSessionInclude
  }>

export async function getSessionById(
  id: string,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionWithRelations | null> {
  return client.dugsiAttendanceSession.findUnique({
    where: { id },
    include: attendanceSessionInclude,
  })
}

export interface AttendanceSessionFilters {
  classId?: string
  teacherId?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginatedSessions {
  data: AttendanceSessionWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function buildSessionWhereClause(
  filters: AttendanceSessionFilters
): Prisma.DugsiAttendanceSessionWhereInput {
  const { classId, teacherId, dateFrom, dateTo } = filters
  return {
    ...(classId && { classId }),
    ...(teacherId && { teacherId }),
    ...((dateFrom || dateTo) && { date: buildDateFilter(dateFrom, dateTo) }),
  }
}

const SESSION_ORDER_BY: Prisma.DugsiAttendanceSessionOrderByWithRelationInput[] =
  [{ date: 'desc' }, { createdAt: 'desc' }]

export async function getSessions(
  filters: AttendanceSessionFilters = {},
  pagination: { page?: number; limit?: number } = {},
  client: DatabaseClient = prisma
): Promise<PaginatedSessions> {
  const { page = 1, limit = DEFAULT_QUERY_LIMIT } = pagination
  const skip = (page - 1) * limit
  const where = buildSessionWhereClause(filters)

  const [data, total] = await Promise.all([
    client.dugsiAttendanceSession.findMany({
      where,
      include: attendanceSessionInclude,
      skip,
      take: limit,
      orderBy: SESSION_ORDER_BY,
    }),
    client.dugsiAttendanceSession.count({ where }),
  ])

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getSessionByClassAndDate(
  classId: string,
  date: Date,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionWithRelations | null> {
  const dateOnly = new Date(getLocalDateString(date))
  return client.dugsiAttendanceSession.findUnique({
    where: {
      date_classId: {
        date: dateOnly,
        classId,
      },
    },
    include: attendanceSessionInclude,
  })
}

export async function getEnrolledStudentsByClass(
  classId: string,
  client: DatabaseClient = prisma
) {
  const enrollments = await client.dugsiClassEnrollment.findMany({
    where: {
      classId,
      isActive: true,
    },
    select: {
      programProfileId: true,
      programProfile: {
        select: {
          familyReferenceId: true,
          person: { select: { name: true } },
        },
      },
    },
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  const studentsWithFamily = enrollments.map((e) => ({
    programProfileId: e.programProfileId,
    name: e.programProfile.person.name,
    familyReferenceId: e.programProfile.familyReferenceId,
  }))

  return sortByFamilyThenName(studentsWithFamily).map(
    ({ programProfileId, name }) => ({ programProfileId, name })
  )
}

export async function getActiveClasses(client: DatabaseClient = prisma) {
  return client.dugsiClass.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      shift: true,
      teachers: {
        where: { isActive: true },
        select: {
          teacher: { select: { person: { select: { name: true } } } },
        },
        take: 1,
      },
    },
  })
}

const getActiveClassesCached = unstable_cache(
  async () => getActiveClasses(),
  ['dugsi-active-classes'],
  { tags: ['dugsi-classes'], revalidate: 3600 }
)

export async function getActiveClassesCachedQuery(
  client: DatabaseClient = prisma
) {
  if (client !== prisma) return getActiveClasses(client)
  return getActiveClassesCached()
}

export const attendanceSessionListInclude = {
  class: true,
  teacher: {
    include: {
      person: true,
    },
  },
  records: {
    select: { status: true },
  },
} as const satisfies Prisma.DugsiAttendanceSessionInclude

export type AttendanceSessionListView =
  Prisma.DugsiAttendanceSessionGetPayload<{
    include: typeof attendanceSessionListInclude
  }>

export interface PaginatedSessionList {
  data: AttendanceSessionListView[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getSessionsForList(
  filters: AttendanceSessionFilters = {},
  pagination: { page?: number; limit?: number } = {},
  client: DatabaseClient = prisma
): Promise<PaginatedSessionList> {
  const { page = 1, limit = DEFAULT_QUERY_LIMIT } = pagination
  const skip = (page - 1) * limit
  const where = buildSessionWhereClause(filters)

  const [data, total] = await Promise.all([
    client.dugsiAttendanceSession.findMany({
      where,
      include: attendanceSessionListInclude,
      skip,
      take: limit,
      orderBy: SESSION_ORDER_BY,
    }),
    client.dugsiAttendanceSession.count({ where }),
  ])

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getEnrolledStudentsByClasses(
  classIds: string[],
  client: DatabaseClient = prisma
): Promise<Map<string, { programProfileId: string; name: string }[]>> {
  if (classIds.length === 0) return new Map()

  const enrollments = await client.dugsiClassEnrollment.findMany({
    where: {
      classId: { in: classIds },
      isActive: true,
    },
    select: {
      classId: true,
      programProfileId: true,
      programProfile: {
        select: {
          familyReferenceId: true,
          person: { select: { name: true } },
        },
      },
    },
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  const map = new Map<
    string,
    {
      programProfileId: string
      name: string
      familyReferenceId: string | null
    }[]
  >()
  for (const e of enrollments) {
    const list = map.get(e.classId) ?? []
    list.push({
      programProfileId: e.programProfileId,
      name: e.programProfile.person.name,
      familyReferenceId: e.programProfile.familyReferenceId,
    })
    map.set(e.classId, list)
  }

  for (const [classId, students] of Array.from(map.entries())) {
    map.set(classId, sortByFamilyThenName(students))
  }

  return map
}

export async function getTodaySessions(
  teacherId?: string,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionWithRelations[]> {
  const dateOnly = new Date(getLocalDateString())
  const where: Prisma.DugsiAttendanceSessionWhereInput = { date: dateOnly }
  if (teacherId) where.teacherId = teacherId
  return client.dugsiAttendanceSession.findMany({
    where,
    include: attendanceSessionInclude,
    orderBy: { class: { shift: 'asc' } },
  })
}

export async function fetchTodaySessionsForList(
  teacherId?: string,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionListView[]> {
  const dateOnly = new Date(getLocalDateString())
  const where: Prisma.DugsiAttendanceSessionWhereInput = { date: dateOnly }
  if (teacherId) where.teacherId = teacherId
  return client.dugsiAttendanceSession.findMany({
    where,
    include: attendanceSessionListInclude,
    orderBy: { class: { shift: 'asc' } },
  })
}

export async function getTodaySessionsForList(
  teacherId?: string,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionListView[]> {
  if (client !== prisma) return fetchTodaySessionsForList(teacherId, client)

  const cached = unstable_cache(
    async () => fetchTodaySessionsForList(teacherId),
    ['today-sessions', teacherId ?? ''],
    { tags: ['today-sessions'], revalidate: 60 }
  )
  return cached()
}

export interface AttendanceStats {
  totalSessions: number
  totalRecords: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  attendanceRate: number
}

export async function getAttendanceStats(
  filters: AttendanceSessionFilters = {},
  client: DatabaseClient = prisma
): Promise<AttendanceStats> {
  const sessionWhere = buildSessionWhereClause(filters)

  const [totalSessions, statusCounts] = await Promise.all([
    client.dugsiAttendanceSession.count({ where: sessionWhere }),
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: { session: sessionWhere },
      _count: { status: true },
    }),
  ])

  const countByStatus = aggregateStatusCounts(statusCounts)
  const presentCount = countByStatus['PRESENT'] ?? 0
  const absentCount = countByStatus['ABSENT'] ?? 0
  const lateCount = countByStatus['LATE'] ?? 0
  const excusedCount = countByStatus['EXCUSED'] ?? 0
  const { rate, total: totalRecords } = rateFromStatusCounts(statusCounts)

  return {
    totalSessions,
    totalRecords,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate: Math.round(rate * 10) / 10,
  }
}

export async function getAttendanceStatsCached(
  filters: AttendanceSessionFilters = {},
  client: DatabaseClient = prisma
): Promise<AttendanceStats> {
  if (client !== prisma) return getAttendanceStats(filters, client)

  const key = JSON.stringify({
    classId: filters.classId ?? '',
    dateFrom: filters.dateFrom?.toISOString() ?? '',
    dateTo: filters.dateTo?.toISOString() ?? '',
  })

  const cached = unstable_cache(
    async () => getAttendanceStats(filters),
    ['attendance-stats', key],
    { tags: ['attendance-stats'], revalidate: 60 }
  )

  return cached()
}

export async function getActiveStudentCount(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<number> {
  return client.dugsiClassEnrollment.count({
    where: {
      isActive: true,
      class: {
        teachers: {
          some: { teacherId, isActive: true },
        },
      },
    },
  })
}

export interface ShiftStat {
  shift: Shift
  sessions: number
  students: number
  rate: number
}

export async function getTeacherShiftStats(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<ShiftStat[]> {
  const classes = await client.dugsiClass.findMany({
    where: {
      isActive: true,
      teachers: { some: { teacherId, isActive: true } },
    },
    select: { id: true, shift: true },
  })

  if (classes.length === 0) return []

  const shiftGroups = new Map<Shift, string[]>()
  for (const c of classes) {
    const ids = shiftGroups.get(c.shift) ?? []
    ids.push(c.id)
    shiftGroups.set(c.shift, ids)
  }

  const allClassIds = classes.map((c) => c.id)
  const shiftEntries = Array.from(shiftGroups)

  const [sessionCounts, studentCounts, ...shiftStatusCounts] =
    await Promise.all([
      client.dugsiAttendanceSession.groupBy({
        by: ['classId'],
        where: { teacherId, classId: { in: allClassIds } },
        _count: { _all: true },
      }),
      client.dugsiClassEnrollment.groupBy({
        by: ['classId'],
        where: { classId: { in: allClassIds }, isActive: true },
        _count: { _all: true },
      }),
      ...shiftEntries.map(([, classIds]) =>
        client.dugsiAttendanceRecord.groupBy({
          by: ['status'],
          where: { session: { teacherId, classId: { in: classIds } } },
          _count: { status: true },
        })
      ),
    ])

  const sessionCountByClass = new Map(
    sessionCounts.map((r) => [r.classId, r._count._all])
  )
  const studentCountByClass = new Map(
    studentCounts.map((r) => [r.classId, r._count._all])
  )

  const results = shiftEntries.map(([shift, classIds], i) => {
    let sessions = 0
    let students = 0
    for (const id of classIds) {
      sessions += sessionCountByClass.get(id) ?? 0
      students += studentCountByClass.get(id) ?? 0
    }

    const { rate: rawRate } = rateFromStatusCounts(shiftStatusCounts[i])
    return {
      shift,
      sessions,
      students,
      rate: Math.round(rawRate * 10) / 10,
    }
  })

  results.sort((a, b) => {
    if (a.shift === b.shift) return 0
    return a.shift === 'MORNING' ? -1 : 1
  })
  return results
}

export interface MonthlyTrendWithShifts {
  overall: { diff: number } | null
  byShift: { shift: Shift; diff: number | null }[]
}

export async function getTeacherMonthlyTrendWithShifts(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<MonthlyTrendWithShifts> {
  const todayStr = getLocalDateString()
  const [year, month] = todayStr.split('-').map(Number)
  const currentMonthStart = new Date(
    `${year}-${String(month).padStart(2, '0')}-01`
  )
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const previousMonthStart = new Date(
    `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  )

  const classes = await client.dugsiClass.findMany({
    where: {
      isActive: true,
      teachers: { some: { teacherId, isActive: true } },
    },
    select: { id: true, shift: true },
  })

  const shiftGroups = new Map<Shift, string[]>()
  for (const c of classes) {
    const ids = shiftGroups.get(c.shift) ?? []
    ids.push(c.id)
    shiftGroups.set(c.shift, ids)
  }

  const shiftEntries = Array.from(shiftGroups)

  const [currentAll, previousAll, ...shiftResults] = await Promise.all([
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: { teacherId, date: { gte: currentMonthStart } },
      },
      _count: { status: true },
    }),
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: {
          teacherId,
          date: { gte: previousMonthStart, lt: currentMonthStart },
        },
      },
      _count: { status: true },
    }),
    ...shiftEntries.flatMap(([, classIds]) => [
      client.dugsiAttendanceRecord.groupBy({
        by: ['status'],
        where: {
          session: {
            teacherId,
            classId: { in: classIds },
            date: { gte: currentMonthStart },
          },
        },
        _count: { status: true },
      }),
      client.dugsiAttendanceRecord.groupBy({
        by: ['status'],
        where: {
          session: {
            teacherId,
            classId: { in: classIds },
            date: { gte: previousMonthStart, lt: currentMonthStart },
          },
        },
        _count: { status: true },
      }),
    ]),
  ])

  const prevAll = rateFromStatusCounts(previousAll)
  const overall =
    prevAll.total === 0
      ? null
      : {
          diff:
            Math.round(
              (rateFromStatusCounts(currentAll).rate - prevAll.rate) * 10
            ) / 10,
        }

  const byShift = shiftEntries.map(([shift], i) => {
    const currentShift = shiftResults[i * 2]
    const previousShift = shiftResults[i * 2 + 1]

    const prev = rateFromStatusCounts(previousShift)
    if (prev.total === 0) {
      return { shift, diff: null }
    }
    return {
      shift,
      diff:
        Math.round((rateFromStatusCounts(currentShift).rate - prev.rate) * 10) /
        10,
    }
  })

  byShift.sort((a, b) => {
    if (a.shift === b.shift) return 0
    return a.shift === 'MORNING' ? -1 : 1
  })
  return { overall, byShift }
}

export async function getActiveTeachers(client: DatabaseClient = prisma) {
  return client.teacher.findMany({
    where: { dugsiClasses: { some: { isActive: true } } },
    select: { id: true, person: { select: { name: true } } },
    orderBy: { person: { name: 'asc' } },
  })
}
