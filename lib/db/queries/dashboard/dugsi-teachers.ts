/**
 * Consolidated Dugsi Teacher Dashboard Query
 *
 * Single optimized query that fetches all teacher data needed for the dashboard:
 * - Teacher details (name, contact info)
 * - Program enrollments
 * - Class assignments and counts
 * - Today's check-in status
 *
 * Replaces 3 separate queries with 1 optimized query.
 */

import { Prisma, Program, Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export interface CheckinStatus {
  clockInTime: Date | null
  clockOutTime: Date | null
  isLate: boolean
}

export interface DugsiTeacherDashboardData {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  programs: Program[]
  classCount: number
  shifts: Shift[]
  morningCheckin: CheckinStatus | null
  afternoonCheckin: CheckinStatus | null
  createdAt: Date
}

const teacherDashboardInclude = {
  person: {
    select: {
      id: true,
      name: true,
      contactPoints: {
        where: { isActive: true },
        select: {
          type: true,
          value: true,
          isPrimary: true,
        },
      },
    },
  },
  programs: {
    where: { isActive: true },
    select: {
      program: true,
      shifts: true,
    },
  },
  dugsiClasses: {
    where: { isActive: true },
    select: {
      id: true,
      class: {
        select: {
          shift: true,
        },
      },
    },
  },
  checkIns: {
    select: {
      shift: true,
      clockInTime: true,
      clockOutTime: true,
      isLate: true,
    },
  },
} as const satisfies Prisma.TeacherInclude

type TeacherWithDashboardData = Prisma.TeacherGetPayload<{
  include: typeof teacherDashboardInclude
}>

/**
 * Get all Dugsi teachers with their dashboard data in a single query.
 * Includes today's check-in status, class counts, and program enrollments.
 */
export async function getDugsiTeachersDashboard(
  date?: Date,
  client: DatabaseClient = prisma
): Promise<DugsiTeacherDashboardData[]> {
  const targetDate = date || new Date()
  const dateOnly = new Date(targetDate.toISOString().split('T')[0])

  const teachers = await client.teacher.findMany({
    where: {
      programs: {
        some: {
          program: 'DUGSI_PROGRAM',
          isActive: true,
        },
      },
    },
    include: {
      ...teacherDashboardInclude,
      checkIns: {
        where: { date: dateOnly },
        select: {
          shift: true,
          clockInTime: true,
          clockOutTime: true,
          isLate: true,
        },
      },
    },
    orderBy: {
      person: { name: 'asc' },
    },
  })

  return teachers.map((teacher) => mapTeacherToDashboardData(teacher))
}

function mapTeacherToDashboardData(
  teacher: TeacherWithDashboardData
): DugsiTeacherDashboardData {
  const contactPoints = teacher.person.contactPoints
  const email = contactPoints.find((cp) => cp.type === 'EMAIL')?.value ?? null
  const phone =
    contactPoints.find((cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP')
      ?.value ?? null

  const dugsiProgram = teacher.programs.find(
    (p) => p.program === 'DUGSI_PROGRAM'
  )
  const assignedShifts = dugsiProgram?.shifts ?? []

  const morningCheckin = teacher.checkIns.find((c) => c.shift === 'MORNING')
  const afternoonCheckin = teacher.checkIns.find((c) => c.shift === 'AFTERNOON')

  return {
    id: teacher.id,
    personId: teacher.person.id,
    name: teacher.person.name,
    email,
    phone,
    programs: teacher.programs.map((p) => p.program) as Program[],
    classCount: teacher.dugsiClasses.length,
    shifts: assignedShifts,
    morningCheckin: morningCheckin
      ? {
          clockInTime: morningCheckin.clockInTime,
          clockOutTime: morningCheckin.clockOutTime,
          isLate: morningCheckin.isLate,
        }
      : null,
    afternoonCheckin: afternoonCheckin
      ? {
          clockInTime: afternoonCheckin.clockInTime,
          clockOutTime: afternoonCheckin.clockOutTime,
          isLate: afternoonCheckin.isLate,
        }
      : null,
    createdAt: teacher.createdAt,
  }
}
