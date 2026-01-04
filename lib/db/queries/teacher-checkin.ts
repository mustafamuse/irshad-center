/**
 * Teacher Check-in Query Functions
 *
 * Query functions for DugsiTeacherCheckIn model.
 * Supports teacher clock-in/out operations and admin reporting.
 */

import { Prisma, Shift } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export const teacherCheckinInclude = {
  teacher: {
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
    },
  },
} as const satisfies Prisma.DugsiTeacherCheckInInclude

export type TeacherCheckinWithRelations = Prisma.DugsiTeacherCheckInGetPayload<{
  include: typeof teacherCheckinInclude
}>

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
  shift?: Shift
  teacherId?: string
}

export async function getCheckinsForDate(
  filters: CheckinDateFilters = {},
  client: DatabaseClient = prisma
): Promise<TeacherCheckinWithRelations[]> {
  const { date, shift, teacherId } = filters
  const targetDate = date || new Date()
  const dateOnly = new Date(targetDate.toISOString().split('T')[0])

  const where: Prisma.DugsiTeacherCheckInWhereInput = {
    date: dateOnly,
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
    orderBy: [{ shift: 'asc' }, { clockInTime: 'asc' }],
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

export interface TeacherWithCheckinStatus {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  shifts: Shift[]
  morningCheckin: TeacherCheckinWithRelations | null
  afternoonCheckin: TeacherCheckinWithRelations | null
}

export async function getAllDugsiTeachersWithTodayStatus(
  date?: Date,
  client: DatabaseClient = prisma
): Promise<TeacherWithCheckinStatus[]> {
  const targetDate = date || new Date()
  const dateOnly = new Date(targetDate.toISOString().split('T')[0])

  const teachers = await client.teacher.findMany({
    where: {
      assignments: {
        some: {
          isActive: true,
          programProfile: {
            program: DUGSI_PROGRAM,
          },
        },
      },
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      assignments: {
        where: {
          isActive: true,
          programProfile: {
            program: DUGSI_PROGRAM,
          },
        },
        select: {
          shift: true,
        },
      },
      checkIns: {
        where: {
          date: dateOnly,
        },
        include: teacherCheckinInclude,
      },
    },
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })

  return teachers.map((teacher) => {
    const email = teacher.person.contactPoints.find(
      (cp) => cp.type === 'EMAIL'
    )?.value
    const phone = teacher.person.contactPoints.find(
      (cp) => cp.type === 'PHONE'
    )?.value

    const shiftValues = teacher.assignments
      .map((a) => a.shift)
      .filter((s): s is Shift => s !== null)
    const shifts = Array.from(new Set(shiftValues))
    const morningCheckin =
      teacher.checkIns.find((c) => c.shift === 'MORNING') || null
    const afternoonCheckin =
      teacher.checkIns.find((c) => c.shift === 'AFTERNOON') || null

    return {
      id: teacher.id,
      personId: teacher.personId,
      name: teacher.person.name,
      email: email || null,
      phone: phone || null,
      shifts,
      morningCheckin,
      afternoonCheckin,
    }
  })
}

export async function getDugsiTeachersForDropdown(
  client: DatabaseClient = prisma
): Promise<
  Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
    shifts: Shift[]
  }>
> {
  const teachers = await client.teacher.findMany({
    where: {
      assignments: {
        some: {
          isActive: true,
          programProfile: {
            program: DUGSI_PROGRAM,
          },
        },
      },
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      assignments: {
        where: {
          isActive: true,
          programProfile: {
            program: DUGSI_PROGRAM,
          },
        },
        select: {
          shift: true,
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
    const email = teacher.person.contactPoints.find(
      (cp) => cp.type === 'EMAIL'
    )?.value
    const phone = teacher.person.contactPoints.find(
      (cp) => cp.type === 'PHONE'
    )?.value

    const shiftValues = teacher.assignments
      .map((a) => a.shift)
      .filter((s): s is Shift => s !== null)
    const shifts = Array.from(new Set(shiftValues))

    return {
      id: teacher.id,
      name: teacher.person.name,
      email: email || null,
      phone: phone || null,
      shifts,
    }
  })
}

export async function isTeacherEnrolledInDugsi(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<boolean> {
  const assignment = await client.teacherAssignment.findFirst({
    where: {
      teacherId,
      isActive: true,
      programProfile: {
        program: DUGSI_PROGRAM,
      },
    },
  })

  return assignment !== null
}

export async function getTeacherShifts(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<Shift[]> {
  const assignments = await client.teacherAssignment.findMany({
    where: {
      teacherId,
      isActive: true,
      programProfile: {
        program: DUGSI_PROGRAM,
      },
    },
    select: {
      shift: true,
    },
  })

  const shiftValues = assignments
    .map((a) => a.shift)
    .filter((s): s is Shift => s !== null)
  return Array.from(new Set(shiftValues))
}
