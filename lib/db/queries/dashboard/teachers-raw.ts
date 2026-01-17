/**
 * Raw SQL Dashboard Query for Teachers
 *
 * Single optimized query that fetches all teacher data for a program.
 * Uses raw SQL for maximum performance - replaces Prisma ORM queries.
 */

import { Program, Shift } from '@prisma/client'

import { prisma } from '@/lib/db'

export interface CheckinStatus {
  clockInTime: Date | null
  clockOutTime: Date | null
  isLate: boolean
}

export interface TeacherDashboardData {
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

interface TeacherDashboardRawRow {
  id: string
  person_id: string
  person_name: string
  person_email: string | null
  person_phone: string | null
  programs: Program[] | string
  shifts: Shift[] | string
  class_count: number
  morning_clock_in: Date | null
  morning_clock_out: Date | null
  morning_is_late: boolean | null
  afternoon_clock_in: Date | null
  afternoon_clock_out: Date | null
  afternoon_is_late: boolean | null
  created_at: Date
}

export async function getTeachersDashboardRaw(
  program: Program
): Promise<TeacherDashboardData[]> {
  const today = new Date()
  const dateOnly = new Date(today.toISOString().split('T')[0])

  const rows = await prisma.$queryRaw<TeacherDashboardRawRow[]>`
    WITH teacher_programs AS (
      SELECT
        tp."teacherId",
        ARRAY_AGG(DISTINCT tp.program) as programs,
        COALESCE(
          (SELECT tp2.shifts FROM "TeacherProgram" tp2
           WHERE tp2."teacherId" = tp."teacherId" AND tp2.program = ${program}::"Program" AND tp2."isActive" = true
           LIMIT 1),
          ARRAY[]::"Shift"[]
        ) as shifts
      FROM "TeacherProgram" tp
      WHERE tp."isActive" = true
      GROUP BY tp."teacherId"
    ),
    teacher_classes AS (
      SELECT dct."teacherId", COUNT(*)::int as class_count
      FROM "DugsiClassTeacher" dct
      WHERE dct."isActive" = true
      GROUP BY dct."teacherId"
    ),
    teacher_checkins AS (
      SELECT
        c."teacherId",
        MAX(CASE WHEN c.shift = 'MORNING' THEN c."clockInTime" END) as morning_clock_in,
        MAX(CASE WHEN c.shift = 'MORNING' THEN c."clockOutTime" END) as morning_clock_out,
        BOOL_OR(CASE WHEN c.shift = 'MORNING' THEN c."isLate" END) as morning_is_late,
        MAX(CASE WHEN c.shift = 'AFTERNOON' THEN c."clockInTime" END) as afternoon_clock_in,
        MAX(CASE WHEN c.shift = 'AFTERNOON' THEN c."clockOutTime" END) as afternoon_clock_out,
        BOOL_OR(CASE WHEN c.shift = 'AFTERNOON' THEN c."isLate" END) as afternoon_is_late
      FROM "DugsiTeacherCheckIn" c
      WHERE c.date = ${dateOnly}
      GROUP BY c."teacherId"
    )
    SELECT
      t.id,
      t."personId" as person_id,
      p.name as person_name,
      (SELECT cp.value FROM "ContactPoint" cp
       WHERE cp."personId" = p.id AND cp.type = 'EMAIL' AND cp."isActive" = true
       LIMIT 1) as person_email,
      (SELECT cp.value FROM "ContactPoint" cp
       WHERE cp."personId" = p.id AND cp.type IN ('PHONE', 'WHATSAPP') AND cp."isActive" = true
       LIMIT 1) as person_phone,
      tp.programs,
      tp.shifts,
      COALESCE(tc.class_count, 0) as class_count,
      tch.morning_clock_in,
      tch.morning_clock_out,
      tch.morning_is_late,
      tch.afternoon_clock_in,
      tch.afternoon_clock_out,
      tch.afternoon_is_late,
      t."createdAt" as created_at
    FROM "Teacher" t
    JOIN "Person" p ON p.id = t."personId"
    JOIN teacher_programs tp ON tp."teacherId" = t.id
    LEFT JOIN teacher_classes tc ON tc."teacherId" = t.id
    LEFT JOIN teacher_checkins tch ON tch."teacherId" = t.id
    WHERE ${program}::"Program" = ANY(tp.programs)
    ORDER BY p.name ASC
  `

  return rows.map(mapRawToTeacherDashboardData)
}

function ensureArray<T>(value: T[] | string | null | undefined): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[{}]/g, '')
    if (!cleaned) return []
    return cleaned.split(',') as T[]
  }
  return []
}

function mapRawToTeacherDashboardData(
  row: TeacherDashboardRawRow
): TeacherDashboardData {
  return {
    id: row.id,
    personId: row.person_id,
    name: row.person_name,
    email: row.person_email,
    phone: row.person_phone,
    programs: ensureArray(row.programs),
    classCount: row.class_count,
    shifts: ensureArray(row.shifts),
    morningCheckin:
      row.morning_clock_in !== null
        ? {
            clockInTime: row.morning_clock_in,
            clockOutTime: row.morning_clock_out,
            isLate: row.morning_is_late ?? false,
          }
        : null,
    afternoonCheckin:
      row.afternoon_clock_in !== null
        ? {
            clockInTime: row.afternoon_clock_in,
            clockOutTime: row.afternoon_clock_out,
            isLate: row.afternoon_is_late ?? false,
          }
        : null,
    createdAt: row.created_at,
  }
}
