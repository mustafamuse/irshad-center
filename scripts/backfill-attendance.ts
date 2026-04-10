/**
 * Backfill Attendance Records
 *
 * Generates TeacherAttendanceRecord rows for all historical weekend dates
 * starting from Jan 17, 2026 for all active Dugsi teachers (except Hamza Hassan).
 *
 * Status rules:
 *   - Closure dates (Mar 14-15, Mar 21-22): CLOSED
 *   - Grace dates (Feb 21-22): SKIP entirely (first day of new schedule)
 *   - Has DugsiTeacherCheckIn: PRESENT or LATE (from isLate flag)
 *   - No check-in: ABSENT
 *
 * Usage:
 *   bun run scripts/backfill-attendance.ts          # dry run (default)
 *   bun run scripts/backfill-attendance.ts --commit  # write to DB
 *
 * Idempotent: uses upsert on (teacherId, date, shift) unique constraint.
 */

import { Program, Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { prisma } from '@/lib/db'

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKFILL_FROM = '2026-01-17'
// Excluded teacher — will start fresh. Fill in the actual UUID before running.
// Find it with: SELECT t.id FROM "Teacher" t JOIN "Person" p ON p.id = t."personId" WHERE p.name = 'Hamza Hassan';
const SKIP_TEACHER_ID = 'TODO_REPLACE_WITH_HAMZA_HASSAN_TEACHER_UUID'

// Dates to mark as CLOSED (school was closed)
const CLOSURE_DATES = new Set([
  '2026-03-14',
  '2026-03-15',
  '2026-03-21',
  '2026-03-22',
])

// Dates to skip entirely (grace period — don't backfill, don't mark absent)
const GRACE_DATES = new Set([
  '2026-02-21',
  '2026-02-22',
])

// ============================================================================
// HELPERS
// ============================================================================

function getWeekendDatesFrom(from: string): string[] {
  const today = new Date()
  const todayStr = formatInTimeZone(today, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const end = new Date(`${todayStr}T12:00:00`)
  const start = new Date(`${from}T12:00:00`)

  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const day = cursor.getDay()
    if (day === 0 || day === 6) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function pad(s: string | number, len: number) {
  return String(s).padEnd(len)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const isDryRun = !process.argv.includes('--commit')

  // Guard: fail fast if the UUID placeholder hasn't been replaced before a real commit run.
  if (!isDryRun && SKIP_TEACHER_ID.startsWith('TODO_')) {
    console.error('ERROR: SKIP_TEACHER_ID is still a placeholder. Replace it with the real UUID before committing.')
    console.error('Run this query to find it:')
    console.error('  SELECT t.id FROM "Teacher" t JOIN "Person" p ON p.id = t."personId" WHERE p.name = \'Hamza Hassan\';')
    process.exit(1)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  DUGSI ATTENDANCE BACKFILL${isDryRun ? ' [DRY RUN]' : ' [COMMITTING]'}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`From: ${BACKFILL_FROM}  |  Skip teacher ID: ${SKIP_TEACHER_ID}`)
  console.log()

  // Load active teachers
  const teacherPrograms = await prisma.teacherProgram.findMany({
    where: { program: Program.DUGSI_PROGRAM, isActive: true },
    include: { teacher: { include: { person: true } } },
  })

  const teachers = teacherPrograms
    .filter((tp) => tp.shifts.length > 0)
    .filter((tp) => tp.teacherId !== SKIP_TEACHER_ID)
    .map((tp) => ({
      id: tp.teacherId,
      name: tp.teacher.person.name,
      shifts: tp.shifts,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  console.log(`Active teachers: ${teachers.map((t) => t.name).join(', ')}`)
  console.log()

  const weekendDates = getWeekendDatesFrom(BACKFILL_FROM)
  console.log(`Weekend dates: ${weekendDates[0]} → ${weekendDates[weekendDates.length - 1]} (${weekendDates.length} days)`)
  console.log()

  // Load all existing check-ins for these teachers in the date range
  const checkins = await prisma.dugsiTeacherCheckIn.findMany({
    where: {
      teacherId: { in: teachers.map((t) => t.id) },
      date: {
        gte: new Date(BACKFILL_FROM),
        lte: new Date(),
      },
    },
  })

  const checkinMap = new Map<string, (typeof checkins)[number]>()
  for (const c of checkins) {
    const dateStr = formatInTimeZone(c.date, 'UTC', 'yyyy-MM-dd')
    checkinMap.set(`${c.teacherId}|${dateStr}|${c.shift}`, c)
  }

  // Gather rows to write
  type Row = {
    teacherName: string
    teacherId: string
    date: string
    shift: Shift
    action: 'SKIP' | 'CLOSED' | 'PRESENT' | 'LATE' | 'ABSENT'
    checkInId?: string
    minutesLate?: number
  }

  const rows: Row[] = []

  for (const teacher of teachers) {
    for (const date of weekendDates) {
      for (const shift of teacher.shifts) {
        if (GRACE_DATES.has(date)) {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'SKIP' })
          continue
        }

        if (CLOSURE_DATES.has(date)) {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'CLOSED' })
          continue
        }

        const checkin = checkinMap.get(`${teacher.id}|${date}|${shift}`)
        if (checkin) {
          rows.push({
            teacherName: teacher.name,
            teacherId: teacher.id,
            date,
            shift,
            action: checkin.isLate ? 'LATE' : 'PRESENT',
            checkInId: checkin.id,
            minutesLate: undefined, // we don't have minutesLate on the fact log; leave null
          })
        } else {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'ABSENT' })
        }
      }
    }
  }

  // Print preview
  const counts = { SKIP: 0, CLOSED: 0, PRESENT: 0, LATE: 0, ABSENT: 0 }
  for (const r of rows) counts[r.action]++

  console.log('Summary:')
  console.log(`  Present: ${counts.PRESENT}`)
  console.log(`  Late:    ${counts.LATE}`)
  console.log(`  Absent:  ${counts.ABSENT}`)
  console.log(`  Closed:  ${counts.CLOSED}`)
  console.log(`  Skipped: ${counts.SKIP}`)
  console.log(`  Total:   ${rows.length}`)
  console.log()

  // Print detail table
  console.log(pad('Teacher', 22) + pad('Date', 12) + pad('Shift', 12) + 'Action')
  console.log('-'.repeat(65))
  for (const r of rows) {
    if (r.action === 'SKIP') continue
    console.log(pad(r.teacherName, 22) + pad(r.date, 12) + pad(r.shift, 12) + r.action)
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] No changes written. Run with --commit to apply.`)
    return
  }

  // Write to DB
  console.log(`\nWriting ${rows.filter((r) => r.action !== 'SKIP').length} records...`)

  // Upsert closure rows in SchoolClosure table
  const closureDateObjs = Array.from(CLOSURE_DATES).map((d) => new Date(d))
  for (const date of closureDateObjs) {
    await prisma.schoolClosure.upsert({
      where: { date },
      create: { date, reason: 'School closed (backfill)', createdBy: 'backfill-script' },
      update: {},
    })
  }

  let written = 0
  for (const r of rows) {
    if (r.action === 'SKIP') continue

    const dateObj = new Date(r.date)
    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date_shift: { teacherId: r.teacherId, date: dateObj, shift: r.shift } },
      create: {
        teacherId: r.teacherId,
        date: dateObj,
        shift: r.shift,
        status: r.action,
        source: 'SYSTEM',
        checkInId: r.checkInId ?? null,
        minutesLate: r.minutesLate ?? null,
      },
      update: {
        // Only set if currently EXPECTED (don't overwrite existing manual changes)
        // We achieve this by re-upsert only if status is EXPECTED
        // Simpler: always update — backfill is run once before any admin changes
        status: r.action,
        source: 'SYSTEM',
        checkInId: r.checkInId ?? null,
        minutesLate: r.minutesLate ?? null,
      },
    })
    written++
  }

  console.log(`Done. ${written} records written.`)
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Fatal error:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
