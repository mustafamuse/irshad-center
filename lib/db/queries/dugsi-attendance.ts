import { unstable_cache } from 'next/cache'

import { Prisma, Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

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

export async function getSessions(
  filters: AttendanceSessionFilters = {},
  pagination: { page?: number; limit?: number } = {},
  client: DatabaseClient = prisma
): Promise<PaginatedSessions> {
  const { classId, teacherId, dateFrom, dateTo } = filters
  const { page = 1, limit = 50 } = pagination
  const skip = (page - 1) * limit

  const where: Prisma.DugsiAttendanceSessionWhereInput = {}

  if (classId) where.classId = classId
  if (teacherId) where.teacherId = teacherId

  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) {
      where.date.gte = new Date(dateFrom.toISOString().split('T')[0])
    }
    if (dateTo) {
      where.date.lte = new Date(dateTo.toISOString().split('T')[0])
    }
  }

  const [data, total] = await Promise.all([
    client.dugsiAttendanceSession.findMany({
      where,
      include: attendanceSessionInclude,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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
  const dateOnly = new Date(date.toISOString().split('T')[0])
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
    include: {
      programProfile: {
        include: {
          person: true,
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

  const students = enrollments.map((e) => ({
    programProfileId: e.programProfileId,
    name: e.programProfile.person.name,
    familyReferenceId: e.programProfile.familyReferenceId,
  }))

  students.sort((a, b) => {
    if (a.familyReferenceId && b.familyReferenceId) {
      if (a.familyReferenceId === b.familyReferenceId)
        return a.name.localeCompare(b.name)
      return a.familyReferenceId.localeCompare(b.familyReferenceId)
    }
    if (a.familyReferenceId) return -1
    if (b.familyReferenceId) return 1
    return a.name.localeCompare(b.name)
  })

  return students
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
  const { classId, teacherId, dateFrom, dateTo } = filters
  const { page = 1, limit = 50 } = pagination
  const skip = (page - 1) * limit

  const where: Prisma.DugsiAttendanceSessionWhereInput = {}

  if (classId) where.classId = classId
  if (teacherId) where.teacherId = teacherId

  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) {
      where.date.gte = new Date(dateFrom.toISOString().split('T')[0])
    }
    if (dateTo) {
      where.date.lte = new Date(dateTo.toISOString().split('T')[0])
    }
  }

  const [data, total] = await Promise.all([
    client.dugsiAttendanceSession.findMany({
      where,
      include: attendanceSessionListInclude,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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
    include: {
      programProfile: {
        include: {
          person: true,
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

  for (const students of Array.from(map.values())) {
    students.sort(
      (
        a: { familyReferenceId: string | null; name: string },
        b: { familyReferenceId: string | null; name: string }
      ) => {
        if (a.familyReferenceId && b.familyReferenceId) {
          if (a.familyReferenceId === b.familyReferenceId)
            return a.name.localeCompare(b.name)
          return a.familyReferenceId.localeCompare(b.familyReferenceId)
        }
        if (a.familyReferenceId) return -1
        if (b.familyReferenceId) return 1
        return a.name.localeCompare(b.name)
      }
    )
  }

  return map
}

export async function getTodaySessions(
  teacherId?: string,
  client: DatabaseClient = prisma
): Promise<AttendanceSessionWithRelations[]> {
  const today = new Date()
  const dateOnly = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  )
  const where: Prisma.DugsiAttendanceSessionWhereInput = { date: dateOnly }
  if (teacherId) where.teacherId = teacherId
  return client.dugsiAttendanceSession.findMany({
    where,
    include: attendanceSessionInclude,
    orderBy: { class: { shift: 'asc' } },
  })
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
  const { classId, teacherId, dateFrom, dateTo } = filters

  const sessionWhere: Prisma.DugsiAttendanceSessionWhereInput = {}
  if (classId) sessionWhere.classId = classId
  if (teacherId) sessionWhere.teacherId = teacherId
  if (dateFrom || dateTo) {
    sessionWhere.date = {}
    if (dateFrom)
      sessionWhere.date.gte = new Date(dateFrom.toISOString().split('T')[0])
    if (dateTo)
      sessionWhere.date.lte = new Date(dateTo.toISOString().split('T')[0])
  }

  const [totalSessions, statusCounts] = await Promise.all([
    client.dugsiAttendanceSession.count({ where: sessionWhere }),
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: { session: sessionWhere },
      _count: { status: true },
    }),
  ])

  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  )

  const presentCount = countByStatus['PRESENT'] ?? 0
  const absentCount = countByStatus['ABSENT'] ?? 0
  const lateCount = countByStatus['LATE'] ?? 0
  const excusedCount = countByStatus['EXCUSED'] ?? 0
  const totalRecords = presentCount + absentCount + lateCount + excusedCount
  const attendanceRate =
    totalRecords > 0 ? ((presentCount + lateCount) / totalRecords) * 100 : 0

  return {
    totalSessions,
    totalRecords,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
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
    { tags: ['attendance-stats'], revalidate: 300 }
  )

  return cached()
}

export async function getActiveStudentCount(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<number> {
  const count = await client.dugsiClassEnrollment.count({
    where: {
      isActive: true,
      class: {
        teachers: {
          some: { teacherId, isActive: true },
        },
      },
    },
  })
  return count
}

export async function getTeacherMonthlyTrend(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<{ diff: number } | null> {
  const now = new Date()
  const currentMonthStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), 1)
  )
  const previousMonthStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)
  )

  const sessionWhere = { teacherId }

  const [currentRecords, previousRecords] = await Promise.all([
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: { ...sessionWhere, date: { gte: currentMonthStart } },
      },
      _count: { status: true },
    }),
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: {
          ...sessionWhere,
          date: { gte: previousMonthStart, lt: currentMonthStart },
        },
      },
      _count: { status: true },
    }),
  ])

  const computeRate = (
    records: { status: string; _count: { status: number } }[]
  ) => {
    const counts = Object.fromEntries(
      records.map((r) => [r.status, r._count.status])
    )
    const present = (counts['PRESENT'] ?? 0) + (counts['LATE'] ?? 0)
    const total =
      (counts['PRESENT'] ?? 0) +
      (counts['ABSENT'] ?? 0) +
      (counts['LATE'] ?? 0) +
      (counts['EXCUSED'] ?? 0)
    return total > 0 ? (present / total) * 100 : 0
  }

  const prevTotal = previousRecords.reduce((sum, r) => sum + r._count.status, 0)
  if (prevTotal === 0) return null

  const currentRate = computeRate(currentRecords)
  const previousRate = computeRate(previousRecords)
  return { diff: Math.round((currentRate - previousRate) * 10) / 10 }
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

  const results: ShiftStat[] = []

  for (const [shift, classIds] of Array.from(shiftGroups)) {
    const [sessionCount, studentCount, statusCounts] = await Promise.all([
      client.dugsiAttendanceSession.count({
        where: { teacherId, classId: { in: classIds } },
      }),
      client.dugsiClassEnrollment.count({
        where: { classId: { in: classIds }, isActive: true },
      }),
      client.dugsiAttendanceRecord.groupBy({
        by: ['status'],
        where: { session: { teacherId, classId: { in: classIds } } },
        _count: { status: true },
      }),
    ])

    const counts = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.status])
    )
    const present = (counts['PRESENT'] ?? 0) + (counts['LATE'] ?? 0)
    const total =
      (counts['PRESENT'] ?? 0) +
      (counts['ABSENT'] ?? 0) +
      (counts['LATE'] ?? 0) +
      (counts['EXCUSED'] ?? 0)
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0

    results.push({
      shift,
      sessions: sessionCount,
      students: studentCount,
      rate,
    })
  }

  results.sort((a) => (a.shift === 'MORNING' ? -1 : 1))
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
  const now = new Date()
  const currentMonthStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), 1)
  )
  const previousMonthStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)
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

  const computeRate = (
    records: { status: string; _count: { status: number } }[]
  ) => {
    const counts = Object.fromEntries(
      records.map((r) => [r.status, r._count.status])
    )
    const present = (counts['PRESENT'] ?? 0) + (counts['LATE'] ?? 0)
    const total =
      (counts['PRESENT'] ?? 0) +
      (counts['ABSENT'] ?? 0) +
      (counts['LATE'] ?? 0) +
      (counts['EXCUSED'] ?? 0)
    return { rate: total > 0 ? (present / total) * 100 : 0, total }
  }

  const [currentAll, previousAll] = await Promise.all([
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
  ])

  const prevAll = computeRate(previousAll)
  const overall =
    prevAll.total === 0
      ? null
      : {
          diff:
            Math.round((computeRate(currentAll).rate - prevAll.rate) * 10) / 10,
        }

  const byShift: { shift: Shift; diff: number | null }[] = []
  for (const [shift, classIds] of Array.from(shiftGroups)) {
    const [currentShift, previousShift] = await Promise.all([
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
    ])

    const prev = computeRate(previousShift)
    if (prev.total === 0) {
      byShift.push({ shift, diff: null })
    } else {
      byShift.push({
        shift,
        diff:
          Math.round((computeRate(currentShift).rate - prev.rate) * 10) / 10,
      })
    }
  }

  byShift.sort((a) => (a.shift === 'MORNING' ? -1 : 1))
  return { overall, byShift }
}

export async function getActiveTeachers(client: DatabaseClient = prisma) {
  return client.teacher.findMany({
    where: { dugsiClasses: { some: { isActive: true } } },
    select: { id: true, person: { select: { name: true } } },
    orderBy: { person: { name: 'asc' } },
  })
}
