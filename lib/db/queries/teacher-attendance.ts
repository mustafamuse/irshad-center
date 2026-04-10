/**
 * Teacher Attendance Query Functions
 *
 * Query layer for TeacherAttendanceRecord, DugsiAttendanceConfig,
 * SchoolClosure, and ExcuseRequest models.
 * All functions accept an optional DatabaseClient to participate in transactions.
 */

import { Prisma, PrismaClient, Program, Shift, TeacherAttendanceStatus } from '@prisma/client'

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

// Grid view only needs teacher name + status — no excuses join
export const attendanceRecordGridInclude = {
  teacher: { include: { person: true } },
} as const satisfies Prisma.TeacherAttendanceRecordInclude

export type AttendanceRecordGridWithRelations = Prisma.TeacherAttendanceRecordGetPayload<{
  include: typeof attendanceRecordGridInclude
}>

// Teacher-facing history: only needs excuses for the "Request Excuse" button.
// Skips the teacher → person join since the caller (fetchAttendanceHistory) never
// accesses r.teacher and the teacherId filter already scopes the query.
export const attendanceSummaryInclude = {
  excuses: { orderBy: { createdAt: 'desc' as const } },
} as const satisfies Prisma.TeacherAttendanceRecordInclude

export type AttendanceRecordSummaryWithRelations = Prisma.TeacherAttendanceRecordGetPayload<{
  include: typeof attendanceSummaryInclude
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

// PrismaClient (not DatabaseClient) — the P2002 catch in the slow path is only safe
// outside a $transaction (PostgreSQL aborts the tx on constraint violations, making
// findUniqueOrThrow run on an already-dead connection). Narrowing to PrismaClient turns
// a tx call site into a compile-time error instead of a runtime throw.
export async function getAttendanceConfig(client: PrismaClient = prisma) {
  // Fast path: the singleton exists on every invocation after first use.
  const existing = await client.dugsiAttendanceConfig.findUnique({ where: { id: 'singleton' } })
  if (existing) return existing

  // First-ever access: create the default row.  The previous upsert with update:{}
  // worked but silently refreshed updatedAt on every read, making it useless as a
  // "last configured" timestamp.
  // The rare concurrent-first-access race (two callers both read null) is handled by
  // catching the P2002 PK conflict and re-fetching the row the winner just created.
  try {
    return await client.dugsiAttendanceConfig.create({
      data: { id: 'singleton', morningAutoMarkMinutes: 15, afternoonAutoMarkMinutes: 15 },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return client.dugsiAttendanceConfig.findUniqueOrThrow({ where: { id: 'singleton' } })
    }
    throw err
  }
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

/**
 * Narrow fetch for service-layer ownership/status checks.
 * Avoids the teacher+person+excuses joins that getAttendanceRecordById pulls in
 * when all we need is id, teacherId, and status.
 */
export async function getAttendanceRecordStatus(
  id: string,
  client: DatabaseClient = prisma
) {
  return client.teacherAttendanceRecord.findUnique({
    where: { id },
    select: { id: true, teacherId: true, status: true },
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

// All records for a teacher across a date range — used for teacher-facing history.
// Uses the slim attendanceSummaryInclude (excuses only) since callers never access
// r.teacher. Admin detail views query directly with attendanceRecordInclude.
export async function getTeacherAttendanceSummary(
  teacherId: string,
  fromDate: Date,
  toDate: Date,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordSummaryWithRelations[]> {
  return client.teacherAttendanceRecord.findMany({
    where: {
      teacherId,
      date: { gte: fromDate, lte: toDate },
    },
    include: attendanceSummaryInclude,
    orderBy: [{ date: 'desc' }, { shift: 'asc' }],
  })
}

// Grid data for admin attendance overview: all teachers × recent weekend dates
// NOTE: No take limit — at ~10 teachers × 2 shifts × 16 dates ≈ 320 rows the result
// set is small. If the roster grows beyond 30+ teachers, add server-side pagination
// here (cursor-based) and a matching `after` param before this becomes a slow page load.
export async function getAttendanceGrid(
  fromDate: Date,
  toDate: Date,
  client: DatabaseClient = prisma
): Promise<AttendanceRecordGridWithRelations[]> {
  return client.teacherAttendanceRecord.findMany({
    where: { date: { gte: fromDate, lt: toDate } },
    include: attendanceRecordGridInclude,
    orderBy: [{ date: 'desc' }, { shift: 'asc' }, { teacher: { person: { name: 'asc' } } }],
  })
}

// Counts attendance records with status=EXCUSED for a teacher in a given month.
// NOTE: this counts any EXCUSED record — including admin-overridden ones — not just
// excuse requests. Renamed from getMonthlyExcuseCount to clarify what's measured.
// If this ever drives an enforcement rule (max N per month), switch to counting
// ExcuseRequest rows with status=APPROVED instead.
export async function getMonthlyExcusedCount(
  teacherId: string,
  year: number,
  month: number, // 1-based
  client: DatabaseClient = prisma
): Promise<number> {
  // Use Date.UTC to avoid local-timezone shifts when constructing midnight boundaries.
  // `lt` on first-of-next-month is unambiguous and avoids last-day-of-month edge cases.
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1)) // exclusive upper bound (first of next month)

  return client.teacherAttendanceRecord.count({
    where: {
      teacherId,
      status: 'EXCUSED',
      date: { gte: from, lt: to },
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

export async function listSchoolClosures(
  from?: Date,
  to?: Date,
  client: DatabaseClient = prisma
) {
  // Default lower bound: 2 years back — prevents unbounded full-table scans.
  // Use `from || to` so a caller supplying only `to` doesn't silently drop the upper bound.
  const defaultFrom = new Date(Date.UTC(new Date().getUTCFullYear() - 2, 0, 1))
  return client.schoolClosure.findMany({
    where: from || to
      ? { date: { ...(from ? { gte: from } : { gte: defaultFrom }), ...(to ? { lt: to } : {}) } }
      : { date: { gte: defaultFrom } },
    orderBy: { date: 'desc' },
  })
}

export async function updateAttendanceConfig(
  data: { morningAutoMarkMinutes: number; afternoonAutoMarkMinutes: number; updatedBy?: string },
  client: DatabaseClient = prisma
) {
  return client.dugsiAttendanceConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
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

// ============================================================================
// TEACHER SHIFTS
// ============================================================================

export interface TeacherShift {
  teacherId: string
  shifts: Shift[]
}

/**
 * Returns all active Dugsi teachers with their assigned shifts.
 * Used by auto-mark and expected-slot generation — extracted from the action/service
 * layers so the query is defined once and testable in isolation.
 */
export async function getActiveDugsiTeacherShifts(
  client: DatabaseClient = prisma
): Promise<TeacherShift[]> {
  const rows = await client.teacherProgram.findMany({
    where: { program: Program.DUGSI_PROGRAM, isActive: true },
    select: { teacherId: true, shifts: true },
  })
  return rows
}
