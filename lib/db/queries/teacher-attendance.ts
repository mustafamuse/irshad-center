/**
 * Teacher Attendance Query Functions
 *
 * Query layer for TeacherAttendanceRecord, DugsiAttendanceConfig,
 * SchoolClosure, and ExcuseRequest models.
 * All functions accept an optional DatabaseClient to participate in transactions.
 */

import { Prisma, Shift, TeacherAttendanceStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

// ============================================================================
// INCLUDES
// ============================================================================

export const attendanceRecordInclude = {
  teacher: { include: { person: true } },
  excuses: { orderBy: { createdAt: 'desc' as const } },
} as const satisfies Prisma.TeacherAttendanceRecordInclude

export type AttendanceRecordWithRelations = Prisma.TeacherAttendanceRecordGetPayload<{
  include: typeof attendanceRecordInclude
}>

export const excuseRequestInclude = {
  attendanceRecord: { include: { teacher: { include: { person: true } } } },
} as const satisfies Prisma.ExcuseRequestInclude

export type ExcuseRequestWithRelations = Prisma.ExcuseRequestGetPayload<{
  include: typeof excuseRequestInclude
}>

// ============================================================================
// CONFIG (SINGLETON)
// ============================================================================

export async function getAttendanceConfig(client: DatabaseClient = prisma) {
  // upsert with update:{} is the correct singleton pattern: atomic at the DB level
  // (INSERT ... ON CONFLICT DO UPDATE SET id='singleton' is a no-op update).
  // findUnique + create is cheaper on steady state but not atomic — two concurrent callers
  // (e.g. both shifts from autoMarkBothShifts) can both get null and then both try to create.
  return client.dugsiAttendanceConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', morningAutoMarkMinutes: 15, afternoonAutoMarkMinutes: 15 },
    update: {},
  })
}

// ============================================================================
// ATTENDANCE RECORDS
// ============================================================================

export async function getAttendanceRecord(
  teacherId: string,
  date: Date,
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordWithRelations | null> {
  return client.teacherAttendanceRecord.findUnique({
    where: { teacherId_date_shift: { teacherId, date, shift } },
    include: attendanceRecordInclude,
  })
}

export async function getAttendanceRecordById(
  id: string,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordWithRelations | null> {
  return client.teacherAttendanceRecord.findUnique({
    where: { id },
    include: attendanceRecordInclude,
  })
}

export interface AttendanceRecordFilters {
  teacherId?: string
  dateFrom?: Date
  dateTo?: Date
  shift?: Shift
  status?: TeacherAttendanceStatus
}

export async function getAttendanceRecords(
  filters: AttendanceRecordFilters = {},
  client: DatabaseClient = prisma
): Promise<AttendanceRecordWithRelations[]> {
  const { teacherId, dateFrom, dateTo, shift, status } = filters

  const where: Prisma.TeacherAttendanceRecordWhereInput = {}
  if (teacherId) where.teacherId = teacherId
  if (shift) where.shift = shift
  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = dateFrom
    if (dateTo) where.date.lte = dateTo
  }

  return client.teacherAttendanceRecord.findMany({
    where,
    include: attendanceRecordInclude,
    orderBy: [{ date: 'desc' }, { shift: 'asc' }],
  })
}

// Returns all EXPECTED records for a given date+shift (used by auto-mark cron)
export async function getExpectedRecordsForAutoMark(
  date: Date,
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<{ id: string; teacherId: string }[]> {
  return client.teacherAttendanceRecord.findMany({
    where: { date, shift, status: 'EXPECTED' },
    select: { id: true, teacherId: true },
  })
}

// All records for a teacher across a date range — used for admin detail view + teacher history
export async function getTeacherAttendanceSummary(
  teacherId: string,
  fromDate: Date,
  toDate: Date,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordWithRelations[]> {
  return client.teacherAttendanceRecord.findMany({
    where: {
      teacherId,
      date: { gte: fromDate, lte: toDate },
    },
    include: attendanceRecordInclude,
    orderBy: [{ date: 'desc' }, { shift: 'asc' }],
  })
}

// Grid data for admin attendance overview: all teachers × recent weekend dates
export async function getAttendanceGrid(
  fromDate: Date,
  toDate: Date,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordWithRelations[]> {
  return client.teacherAttendanceRecord.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    include: attendanceRecordInclude,
    orderBy: [{ date: 'desc' }, { shift: 'asc' }, { teacher: { person: { name: 'asc' } } }],
  })
}

// Monthly excuse count for a teacher (shown to teacher, not enforced in code)
export async function getMonthlyExcuseCount(
  teacherId: string,
  year: number,
  month: number, // 1-based
  client: DatabaseClient = prisma
): Promise<number> {
  const from = new Date(`${year}-${String(month).padStart(2, '0')}-01`)
  // Use ISO string for `to` so both sides parse as UTC midnight (consistent with `from`)
  const lastDay = new Date(year, month, 0).getDate()
  const to = new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)

  return client.teacherAttendanceRecord.count({
    where: {
      teacherId,
      status: 'EXCUSED',
      date: { gte: from, lte: to },
    },
  })
}

// ============================================================================
// SCHOOL CLOSURES
// ============================================================================

export async function getSchoolClosure(
  date: Date,
  client: DatabaseClient = prisma
) {
  return client.schoolClosure.findUnique({ where: { date } })
}

export async function listSchoolClosures(client: DatabaseClient = prisma) {
  return client.schoolClosure.findMany({ orderBy: { date: 'desc' } })
}

// ============================================================================
// EXCUSE REQUESTS
// ============================================================================

export async function getExcuseRequestById(
  id: string,
  client: DatabaseClient = prisma
): Promise<ExcuseRequestWithRelations | null> {
  return client.excuseRequest.findUnique({
    where: { id },
    include: excuseRequestInclude,
  })
}

export async function getPendingExcuseRequests(
  client: DatabaseClient = prisma
): Promise<ExcuseRequestWithRelations[]> {
  return client.excuseRequest.findMany({
    where: { status: 'PENDING' },
    include: excuseRequestInclude,
    orderBy: { createdAt: 'asc' },
  })
}

export async function getExistingActiveExcuse(
  attendanceRecordId: string,
  client: DatabaseClient = prisma
) {
  return client.excuseRequest.findFirst({
    where: {
      attendanceRecordId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  })
}
