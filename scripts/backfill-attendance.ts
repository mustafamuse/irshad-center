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

import { AttendanceSource, Program, Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { prisma } from '@/lib/db'

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKFILL_FROM = '2026-01-17'
// Excluded teacher — set SKIP_TEACHER_ID env var before running with --commit.
// Find the UUID: SELECT t.id FROM "Teacher" t JOIN "Person" p ON p.id = t."personId" WHERE p.name = 'Hamza Hassan';
// Example: SKIP_TEACHER_ID=<uuid> bun run scripts/backfill-attendance.ts --commit
const SKIP_TEACHER_ID = process.env.SKIP_TEACHER_ID ?? ''

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
  const end = new Date(`${todayStr}T12:00:00Z`)
  const start = new Date(`${from}T12:00:00Z`)

  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const day = cursor.getUTCDay()
    if (day === 0 || day === 6) {
      const y = cursor.getUTCFullYear()
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const d = String(cursor.getUTCDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
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

  if (!isDryRun && !SKIP_TEACHER_ID) {
    console.warn('WARN: SKIP_TEACHER_ID is not set — all active teachers will be included.')
    console.warn('  To exclude a teacher: SKIP_TEACHER_ID=<uuid> bun run scripts/backfill-attendance.ts --commit')
    console.warn('  Continuing in 3 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  DUGSI ATTENDANCE BACKFILL${isDryRun ? ' [DRY RUN]' : ' [COMMITTING]'}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`From: ${BACKFILL_FROM}  |  Skip teacher ID: ${SKIP_TEACHER_ID || '(none)'}`)
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
    source: AttendanceSource
    checkInId?: string
    minutesLate?: number
  }

  const rows: Row[] = []

  for (const teacher of teachers) {
    for (const date of weekendDates) {
      for (const shift of teacher.shifts) {
        if (GRACE_DATES.has(date)) {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'SKIP', source: AttendanceSource.SYSTEM })
          continue
        }

        if (CLOSURE_DATES.has(date)) {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'CLOSED', source: AttendanceSource.SYSTEM })
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
            source: AttendanceSource.SELF_CHECKIN,
            checkInId: checkin.id,
            minutesLate: undefined, // we don't have minutesLate on the fact log; leave null
          })
        } else {
          rows.push({ teacherName: teacher.name, teacherId: teacher.id, date, shift, action: 'ABSENT', source: AttendanceSource.SYSTEM })
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

  let dbUpdated = 0
  // Wrap closure upserts + attendance writes in one transaction so a crash or
  // SIGTERM mid-run doesn't leave SchoolClosure rows without the corresponding
  // CLOSED attendance records (or vice versa).
  // Re-running is always safe (skipDuplicates + WHERE status='EXPECTED' guard).
  type RowData = {
    teacherId: string; date: Date; shift: Shift
    status: Exclude<Row['action'], 'SKIP'>; source: AttendanceSource
    checkInId: string | null; minutesLate: number | null
  }

  // Expected row count: ~10 teachers × 2 shifts × ~20 weekend dates ≈ 400 rows.
  // Per-row updateMany loop issues one round-trip each; 30 s timeout is conservative
  // but avoids false timeouts on a cold or loaded DB connection.
  console.time('transaction')
  const { dbCreated, dbUnchanged } = await prisma.$transaction(async (tx) => {
    // Upsert SchoolClosure rows inside the transaction so closures and CLOSED
    // attendance records are written atomically.
    await Promise.all(
      Array.from(CLOSURE_DATES).map((d) => {
        const date = new Date(d)
        return tx.schoolClosure.upsert({
          where: { date },
          create: { date, reason: 'School closed (backfill)', createdBy: 'backfill-script' },
          update: {},
        })
      })
    )

    const toCreate: RowData[] = []

    for (const r of rows) {
      if (r.action === 'SKIP') continue
      const dateObj = new Date(r.date)

      // Only overwrite if the record is still EXPECTED — preserves admin manual
      // changes (overrides, excuse approvals) when the script is re-run.
      const updated = await tx.teacherAttendanceRecord.updateMany({
        where: { teacherId: r.teacherId, date: dateObj, shift: r.shift, status: 'EXPECTED' },
        data: { status: r.action, source: r.source, checkInId: r.checkInId ?? null, minutesLate: r.minutesLate ?? null },
      })
      if (updated.count > 0) {
        dbUpdated++
      } else {
        toCreate.push({ teacherId: r.teacherId, date: dateObj, shift: r.shift, status: r.action, source: r.source, checkInId: r.checkInId ?? null, minutesLate: r.minutesLate ?? null })
      }
    }

    // Batch all creates in one query — skipDuplicates silently ignores rows with
    // a non-EXPECTED status (admin overrides) that already exist in the table.
    const created = toCreate.length > 0
      ? (await tx.teacherAttendanceRecord.createMany({ data: toCreate, skipDuplicates: true })).count
      : 0

    return { dbCreated: created, dbUnchanged: toCreate.length - created }
  }, { timeout: 30_000 })
  console.timeEnd('transaction')

  console.log(`Done. ${dbCreated} created, ${dbUpdated} updated, ${dbUnchanged} unchanged (non-EXPECTED — skipped).`)
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Fatal error:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
