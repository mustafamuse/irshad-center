import { unstable_cache } from 'next/cache'

import { Prisma } from '@prisma/client'

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
  const { classId, dateFrom, dateTo } = filters
  const { page = 1, limit = 50 } = pagination
  const skip = (page - 1) * limit

  const where: Prisma.DugsiAttendanceSessionWhereInput = {}

  if (classId) {
    where.classId = classId
  }

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

  return enrollments.map((e) => ({
    programProfileId: e.programProfileId,
    name: e.programProfile.person.name,
  }))
}

export async function getActiveClasses(client: DatabaseClient = prisma) {
  return client.dugsiClass.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      shift: true,
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
  const { classId, dateFrom, dateTo } = filters
  const { page = 1, limit = 50 } = pagination
  const skip = (page - 1) * limit

  const where: Prisma.DugsiAttendanceSessionWhereInput = {}

  if (classId) {
    where.classId = classId
  }

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

  const map = new Map<string, { programProfileId: string; name: string }[]>()
  for (const e of enrollments) {
    const list = map.get(e.classId) ?? []
    list.push({
      programProfileId: e.programProfileId,
      name: e.programProfile.person.name,
    })
    map.set(e.classId, list)
  }
  return map
}

export interface AttendanceStats {
  totalSessions: number
  totalStudents: number
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
  const { classId, dateFrom, dateTo } = filters

  const sessionWhere: Prisma.DugsiAttendanceSessionWhereInput = {}
  if (classId) sessionWhere.classId = classId
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
    totalStudents: totalRecords,
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
