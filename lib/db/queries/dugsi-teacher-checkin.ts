import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import type { DatabaseClient } from '@/lib/db/types'
import type { TeacherCheckInDTO } from '@/lib/types/dugsi-attendance'

export interface DateRangeFilter {
  startDate?: Date
  endDate?: Date
}

export async function getTeacherCheckIn(
  teacherId: string,
  date: Date,
  shift: Shift,
  client: DatabaseClient = prisma
) {
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  return client.dugsiTeacherCheckIn.findUnique({
    where: {
      teacherId_date_shift: { teacherId, date: dateOnly, shift },
    },
    include: {
      teacher: {
        include: { person: { select: { name: true } } },
      },
    },
  })
}

export async function getTeacherCheckIns(
  dateRange: DateRangeFilter = {},
  client: DatabaseClient = prisma
): Promise<TeacherCheckInDTO[]> {
  const { startDate, endDate } = dateRange

  const dateFilter = {} as { gte?: Date; lte?: Date }
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  const checkIns = await client.dugsiTeacherCheckIn.findMany({
    where: {
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    include: {
      teacher: {
        include: { person: { select: { name: true } } },
      },
    },
    orderBy: [{ date: 'desc' }, { clockInTime: 'desc' }],
  })

  return checkIns.map((c) => ({
    id: c.id,
    teacherId: c.teacherId,
    teacherName: c.teacher.person.name,
    date: c.date,
    shift: c.shift,
    clockInTime: c.clockInTime,
    clockInValid: c.clockInValid,
    clockOutTime: c.clockOutTime,
    isLate: c.isLate,
    notes: c.notes,
  }))
}

export async function getTodaysCheckInsForTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherCheckInDTO[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const checkIns = await client.dugsiTeacherCheckIn.findMany({
    where: {
      teacherId,
      date: today,
    },
    include: {
      teacher: {
        include: { person: { select: { name: true } } },
      },
    },
    orderBy: { clockInTime: 'asc' },
  })

  return checkIns.map((c) => ({
    id: c.id,
    teacherId: c.teacherId,
    teacherName: c.teacher.person.name,
    date: c.date,
    shift: c.shift,
    clockInTime: c.clockInTime,
    clockInValid: c.clockInValid,
    clockOutTime: c.clockOutTime,
    isLate: c.isLate,
    notes: c.notes,
  }))
}

export async function getTeacherCheckInById(
  checkInId: string,
  client: DatabaseClient = prisma
) {
  return client.dugsiTeacherCheckIn.findUnique({
    where: { id: checkInId },
    include: {
      teacher: {
        include: { person: { select: { name: true } } },
      },
    },
  })
}
