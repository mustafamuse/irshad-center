/**
 * Teacher Check-in Query Functions
 *
 * Query functions for DugsiTeacherCheckIn model.
 * Supports teacher clock-in/out operations and admin reporting.
 */

import { cache } from 'react'

import { Prisma, Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export const teacherCheckinInclude = {
  teacher: {
    include: {
      person: {
        select: {
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.DugsiTeacherCheckInInclude

export type TeacherCheckinWithRelations = Prisma.DugsiTeacherCheckInGetPayload<{
  include: typeof teacherCheckinInclude
}>

export interface CheckinSnapshot {
  id: string
  teacherId: string
  date: Date
  shift: Shift
  clockInTime: Date
  clockOutTime: Date | null
  isLate: boolean
  clockInValid: boolean
  notes: string | null
  clockInLat: number | null
  clockInLng: number | null
  clockOutLat: number | null
  clockOutLng: number | null
  createdAt: Date
  updatedAt: Date
  teacher: {
    person: {
      name: string
    }
  }
}

export async function getCheckinById(
  id: string,
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations | null> {
  return client.dugsiTeacherCheckIn.findUnique({
    where: { id },
    include: teacherCheckinInclude,
  })
}

export async function getTeacherCheckin(
  teacherId: string,
  date: Date,
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations | null> {
  const dateOnly = new Date(date.toISOString().split('T')[0])

  return client.dugsiTeacherCheckIn.findUnique({
    where: {
      teacherId_date_shift: {
        teacherId,
        date: dateOnly,
        shift,
      },
    },
    include: teacherCheckinInclude,
  })
}

export interface CheckinDateFilters {
  date?: Date
  dateTo?: Date
  shift?: Shift
  teacherId?: string
}

export async function getCheckinsForDate(
  filters: CheckinDateFilters = {},
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations[]> {
  const { date, dateTo, shift, teacherId } = filters
  const targetDate = date || new Date()
  const dateOnly = new Date(targetDate.toISOString().split('T')[0])

  const where: Prisma.DugsiTeacherCheckInWhereInput = {}

  if (dateTo) {
    const dateToOnly = new Date(dateTo.toISOString().split('T')[0])
    where.date = {
      gte: dateOnly,
      lte: dateToOnly,
    }
  } else {
    where.date = dateOnly
  }

  if (shift) {
    where.shift = shift
  }

  if (teacherId) {
    where.teacherId = teacherId
  }

  return client.dugsiTeacherCheckIn.findMany({
    where,
    include: teacherCheckinInclude,
    orderBy: [{ date: 'asc' }, { shift: 'asc' }, { clockInTime: 'asc' }],
  })
}

export interface CheckinHistoryFilters {
  dateFrom?: Date
  dateTo?: Date
  shift?: Shift
  teacherId?: string
  isLate?: boolean
  clockInValid?: boolean
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedCheckins {
  data: TeacherCheckinWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getCheckinHistory(
  filters: CheckinHistoryFilters = {},
  pagination: PaginationParams = {},
  client: DatabaseClient = prisma
): Promise<PaginatedCheckins> {
  const { dateFrom, dateTo, shift, teacherId, isLate, clockInValid } = filters
  const { page = 1, limit = 50 } = pagination
  const skip = (page - 1) * limit

  const where: Prisma.DugsiTeacherCheckInWhereInput = {}

  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) {
      where.date.gte = new Date(dateFrom.toISOString().split('T')[0])
    }
    if (dateTo) {
      where.date.lte = new Date(dateTo.toISOString().split('T')[0])
    }
  }

  if (shift) {
    where.shift = shift
  }

  if (teacherId) {
    where.teacherId = teacherId
  }

  if (isLate !== undefined) {
    where.isLate = isLate
  }

  if (clockInValid !== undefined) {
    where.clockInValid = clockInValid
  }

  const [data, total] = await Promise.all([
    client.dugsiTeacherCheckIn.findMany({
      where,
      include: teacherCheckinInclude,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { shift: 'asc' }, { clockInTime: 'asc' }],
    }),
    client.dugsiTeacherCheckIn.count({ where }),
  ])

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export interface LateReportFilters {
  dateFrom: Date
  dateTo: Date
  shift?: Shift
  teacherId?: string
}

export async function getLateArrivals(
  filters: LateReportFilters,
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations[]> {
  const { dateFrom, dateTo, shift, teacherId } = filters

  const where: Prisma.DugsiTeacherCheckInWhereInput = {
    isLate: true,
    date: {
      gte: new Date(dateFrom.toISOString().split('T')[0]),
      lte: new Date(dateTo.toISOString().split('T')[0]),
    },
  }

  if (shift) {
    where.shift = shift
  }

  if (teacherId) {
    where.teacherId = teacherId
  }

  return client.dugsiTeacherCheckIn.findMany({
    where,
    include: teacherCheckinInclude,
    orderBy: [{ date: 'desc' }, { clockInTime: 'asc' }],
  })
}

export async function getCheckinsForDateRange(
  dates: Date[],
  teacherIds: string[],
  client: DatabaseClient = prisma
) {
  if (dates.length === 0 || teacherIds.length === 0) {
    return []
  }

  const normalizedDates = dates.map(
    (d) => new Date(d.toISOString().split('T')[0])
  )

  return client.dugsiTeacherCheckIn.findMany({
    where: {
      date: { in: normalizedDates },
      teacherId: { in: teacherIds },
    },
    select: {
      teacherId: true,
      date: true,
      shift: true,
      isLate: true,
      clockInTime: true,
    },
  })
}

export interface TeacherWithCheckinStatus {
  id: string
  personId: string
  name: string
  shifts: Shift[]
  createdAt: Date
  morningCheckin: CheckinSnapshot | null
  afternoonCheckin: CheckinSnapshot | null
}

async function _getAllDugsiTeachersWithTodayStatus(
  date?: Date
): Promise<TeacherWithCheckinStatus[]> {
  const targetDate = date || new Date()
  const dateOnly = new Date(targetDate.toISOString().split('T')[0])

  const teachers = await prisma.teacher.findMany({
    where: {
      dugsiClasses: {
        some: {
          isActive: true,
          class: {
            isActive: true,
          },
        },
      },
    },
    include: {
      person: {
        select: {
          name: true,
        },
      },
      dugsiClasses: {
        where: {
          isActive: true,
          class: {
            isActive: true,
          },
        },
        include: {
          class: {
            select: {
              shift: true,
            },
          },
        },
      },
      checkIns: {
        where: {
          date: dateOnly,
        },
        select: {
          id: true,
          teacherId: true,
          date: true,
          shift: true,
          clockInTime: true,
          clockOutTime: true,
          isLate: true,
          clockInValid: true,
          notes: true,
          clockInLat: true,
          clockInLng: true,
          clockOutLat: true,
          clockOutLng: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })

  return teachers.map((teacher) => {
    const shiftValues = teacher.dugsiClasses.map((dc) => dc.class.shift)
    const shifts = Array.from(new Set(shiftValues))

    const morningRaw = teacher.checkIns.find((c) => c.shift === 'MORNING')
    const afternoonRaw = teacher.checkIns.find((c) => c.shift === 'AFTERNOON')

    const wrapCheckin = (
      raw: (typeof teacher.checkIns)[number] | undefined
    ): CheckinSnapshot | null => {
      if (!raw) return null
      return {
        ...raw,
        teacher: { person: { name: teacher.person.name } },
      }
    }

    return {
      id: teacher.id,
      personId: teacher.personId,
      name: teacher.person.name,
      shifts,
      createdAt: teacher.createdAt,
      morningCheckin: wrapCheckin(morningRaw),
      afternoonCheckin: wrapCheckin(afternoonRaw),
    }
  })
}

export const getAllDugsiTeachersWithTodayStatus = cache(
  _getAllDugsiTeachersWithTodayStatus
)

export type TodayStatus = 'not_checked_in' | 'checked_in' | 'completed'

export async function getDugsiTeachersForDropdown(
  client: DatabaseClient = prisma
): Promise<
  Array<{
    id: string
    name: string
    shifts: Shift[]
    todayStatus: TodayStatus
  }>
> {
  const today = new Date()
  const dateOnly = new Date(today.toISOString().split('T')[0])

  const teachers = await client.teacher.findMany({
    where: {
      dugsiClasses: {
        some: {
          isActive: true,
          class: {
            isActive: true,
          },
        },
      },
    },
    include: {
      person: {
        select: {
          name: true,
        },
      },
      dugsiClasses: {
        where: {
          isActive: true,
          class: {
            isActive: true,
          },
        },
        include: {
          class: {
            select: {
              shift: true,
            },
          },
        },
      },
      checkIns: {
        where: {
          date: dateOnly,
        },
        select: {
          shift: true,
          clockOutTime: true,
        },
      },
    },
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })

  return teachers.map((teacher) => {
    const shiftValues = teacher.dugsiClasses.map((dc) => dc.class.shift)
    const shifts = Array.from(new Set(shiftValues)) as Shift[]

    const relevantCheckins = teacher.checkIns.filter((c) =>
      shifts.includes(c.shift)
    )
    const allShiftsComplete =
      relevantCheckins.length === shifts.length &&
      relevantCheckins.every((c) => c.clockOutTime !== null)
    const hasAnyCheckin = relevantCheckins.length > 0

    let todayStatus: TodayStatus = 'not_checked_in'
    if (allShiftsComplete) {
      todayStatus = 'completed'
    } else if (hasAnyCheckin) {
      todayStatus = 'checked_in'
    }

    return {
      id: teacher.id,
      name: teacher.person.name,
      shifts,
      todayStatus,
    }
  })
}

export async function getDugsiTeachersLightweight(
  client: DatabaseClient = prisma
): Promise<
  Array<{
    id: string
    name: string
    shifts: Shift[]
    createdAt: Date
  }>
> {
  const teachers = await client.teacher.findMany({
    where: {
      dugsiClasses: {
        some: {
          isActive: true,
          class: { isActive: true },
        },
      },
    },
    include: {
      person: { select: { name: true } },
      dugsiClasses: {
        where: { isActive: true, class: { isActive: true } },
        include: { class: { select: { shift: true } } },
      },
    },
    orderBy: { person: { name: 'asc' } },
  })

  return teachers.map((t) => ({
    id: t.id,
    name: t.person.name,
    shifts: Array.from(new Set(t.dugsiClasses.map((dc) => dc.class.shift))),
    createdAt: t.createdAt,
  }))
}

export async function isTeacherEnrolledInDugsi(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<boolean> {
  const classAssignment = await client.dugsiClassTeacher.findFirst({
    where: {
      teacherId,
      isActive: true,
      class: {
        isActive: true,
      },
    },
  })

  return classAssignment !== null
}

export async function getTeacherShifts(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<Shift[]> {
  // Get shifts from TeacherProgram.shifts (directly assigned by admin)
  const teacherProgram = await client.teacherProgram.findFirst({
    where: {
      teacherId,
      program: 'DUGSI_PROGRAM',
      isActive: true,
    },
    select: { shifts: true },
  })

  return teacherProgram?.shifts ?? []
}
