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
 *   bun run scripts/backfill-attendance.ts --commit  # write to DB
 *
 * Idempotent: uses upsert on (teacherId, date, shift) unique constraint.
 */

import { AttendanceSource, Program, Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { prisma } from '@/lib/db'
import { getWeekendDatesBetween } from '@/lib/utils/date-utils'

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKFILL_FROM = '2026-01-17'
const TRANSACTION_TIMEOUT_MS = 30_000
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
const GRACE_DATES = new Set(['2026-02-21', '2026-02-22'])

// ============================================================================
// HELPERS
// ============================================================================

function getWeekendDatesFrom(from: string): string[] {
  const todayStr = formatInTimeZone(new Date(), SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const end = new Date(`${todayStr}T12:00:00Z`)
  const start = new Date(`${from}T12:00:00Z`)
  return getWeekendDatesBetween(start, end)
}

function pad(s: string | number, width: number) {
  return String(s).padEnd(width)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const isDryRun = !process.argv.includes('--commit')

  if (!isDryRun && process.env.SKIP_TEACHER_ID === undefined) {
    console.error('ERROR: SKIP_TEACHER_ID is not set.')
    console.error(
      '  Re-run with SKIP_TEACHER_ID=<uuid> to exclude the intended teacher,'
    )
    console.error(
      '  or set it to an empty string to include everyone intentionally:'
    )
    console.error(
      '    SKIP_TEACHER_ID="" bun run scripts/backfill-attendance.ts --commit'
    )
    process.exit(1)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(
    `  DUGSI ATTENDANCE BACKFILL${isDryRun ? ' [DRY RUN]' : ' [COMMITTING]'}`
  )
  console.log(`${'='.repeat(60)}`)
  console.log(
    `From: ${BACKFILL_FROM}  |  Skip teacher ID: ${SKIP_TEACHER_ID || '(none)'}`
  )
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
  console.log(
    `Weekend dates: ${weekendDates[0]} → ${weekendDates[weekendDates.length - 1]} (${weekendDates.length} days)`
  )
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
    clockInTime?: Date
    minutesLate?: number
  }

  const rows: Row[] = []

  for (const teacher of teachers) {
    for (const date of weekendDates) {
      for (const shift of teacher.shifts) {
        if (GRACE_DATES.has(date)) {
          rows.push({
            teacherName: teacher.name,
            teacherId: teacher.id,
            date,
            shift,
            action: 'SKIP',
            source: AttendanceSource.SYSTEM,
          })
          continue
        }

        if (CLOSURE_DATES.has(date)) {
          rows.push({
            teacherName: teacher.name,
            teacherId: teacher.id,
            date,
            shift,
            action: 'CLOSED',
            source: AttendanceSource.SYSTEM,
          })
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
            clockInTime: checkin.clockInTime,
            minutesLate: undefined, // we don't have minutesLate on the fact log; leave null
          })
        } else {
          rows.push({
            teacherName: teacher.name,
            teacherId: teacher.id,
            date,
            shift,
            action: 'ABSENT',
            source: AttendanceSource.SYSTEM,
          })
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
  console.log(
    pad('Teacher', 22) + pad('Date', 12) + pad('Shift', 12) + 'Action'
  )
  console.log('-'.repeat(65))
  for (const r of rows) {
    if (r.action === 'SKIP') continue
    console.log(
      pad(r.teacherName, 22) + pad(r.date, 12) + pad(r.shift, 12) + r.action
    )
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] No changes written. Run with --commit to apply.`)
    return
  }

  // Write to DB
  console.log(
    `\nWriting ${rows.filter((r) => r.action !== 'SKIP').length} records...`
  )

  type RowData = {
    teacherId: string
    date: Date
    shift: Shift
    status: Exclude<Row['action'], 'SKIP'>
    source: AttendanceSource
    checkInId: string | null
    clockInTime: Date | null
    minutesLate: number | null
  }

  // Pre-fetch existing records outside the transaction to avoid ~400 sequential
  // updateMany round-trips inside the transaction. We partition rows into:
  //   - toCreate: no existing record
  //   - absentIds / closedIds: EXPECTED records to bulk-update in two shots
  //   - presentLateUpdates: EXPECTED records with per-row data (checkInId differs)
  // Rows where an existing record is non-EXPECTED are left untouched (admin overrides).
  const existingRecords = await prisma.teacherAttendanceRecord.findMany({
    where: { teacherId: { in: teachers.map((t) => t.id) } },
    select: {
      id: true,
      teacherId: true,
      date: true,
      shift: true,
      status: true,
    },
  })

  const existingMap = new Map<string, { id: string; status: string }>()
  for (const r of existingRecords) {
    const dateStr = formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd')
    existingMap.set(`${r.teacherId}|${dateStr}|${r.shift}`, {
      id: r.id,
      status: r.status,
    })
  }

  type PresentLateUpdate = {
    id: string
    action: 'PRESENT' | 'LATE'
    source: AttendanceSource
    checkInId: string | null
    clockInTime: Date | null
    minutesLate: number | null
  }

  const toCreate: RowData[] = []
  const absentIds: string[] = []
  const closedIds: string[] = []
  const presentLateUpdates: PresentLateUpdate[] = []
  let dbUpdated = 0

  for (const r of rows) {
    if (r.action === 'SKIP') continue
    const existing = existingMap.get(`${r.teacherId}|${r.date}|${r.shift}`)
    if (!existing) {
      toCreate.push({
        teacherId: r.teacherId,
        date: new Date(r.date),
        shift: r.shift,
        status: r.action,
        source: r.source,
        checkInId: r.checkInId ?? null,
        clockInTime: r.clockInTime ?? null,
        minutesLate: r.minutesLate ?? null,
      })
    } else if (existing.status === 'EXPECTED') {
      dbUpdated++
      if (r.action === 'ABSENT') absentIds.push(existing.id)
      else if (r.action === 'CLOSED') closedIds.push(existing.id)
      else if (r.action === 'PRESENT' || r.action === 'LATE') {
        presentLateUpdates.push({
          id: existing.id,
          action: r.action,
          source: r.source,
          checkInId: r.checkInId ?? null,
          clockInTime: r.clockInTime ?? null,
          minutesLate: r.minutesLate ?? null,
        })
      }
    }
    // else: non-EXPECTED existing record — preserve admin overrides, skip
  }

  // Wrap closure upserts + attendance writes in one transaction so a crash or
  // SIGTERM mid-run doesn't leave SchoolClosure rows without the corresponding
  // CLOSED attendance records (or vice versa).
  console.time('transaction')
  const { dbCreated, dbUnchanged } = await prisma.$transaction(
    async (tx) => {
      await Promise.all([
        // Upsert SchoolClosure rows inside the transaction so closures and CLOSED
        // attendance records are written atomically.
        ...Array.from(CLOSURE_DATES).map((d) => {
          const date = new Date(d)
          return tx.schoolClosure.upsert({
            where: { date },
            create: {
              date,
              reason: 'School closed (backfill)',
              createdBy: 'backfill-script',
            },
            update: {},
          })
        }),
        // Bulk update ABSENT rows — one updateMany for all of them
        absentIds.length > 0
          ? tx.teacherAttendanceRecord.updateMany({
              where: { id: { in: absentIds }, status: 'EXPECTED' },
              data: { status: 'ABSENT', source: AttendanceSource.SYSTEM },
            })
          : Promise.resolve(),
        // Bulk update CLOSED rows — one updateMany for all of them
        closedIds.length > 0
          ? tx.teacherAttendanceRecord.updateMany({
              where: { id: { in: closedIds }, status: 'EXPECTED' },
              data: { status: 'CLOSED', source: AttendanceSource.SYSTEM },
            })
          : Promise.resolve(),
        // PRESENT/LATE rows each have a unique checkInId — run in parallel
        ...presentLateUpdates.map(
          ({ id, action, source, checkInId, clockInTime, minutesLate }) =>
            tx.teacherAttendanceRecord.updateMany({
              where: { id, status: 'EXPECTED' },
              data: {
                status: action,
                source,
                checkInId,
                clockInTime,
                minutesLate,
              },
            })
        ),
      ])

      // Batch all creates in one query — skipDuplicates silently ignores rows with
      // a non-EXPECTED status (admin overrides) that already exist in the table.
      const created =
        toCreate.length > 0
          ? (
              await tx.teacherAttendanceRecord.createMany({
                data: toCreate,
                skipDuplicates: true,
              })
            ).count
          : 0

      return { dbCreated: created, dbUnchanged: toCreate.length - created }
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  )
  console.timeEnd('transaction')

  console.log(
    `Done. ${dbCreated} created, ${dbUpdated} updated, ${dbUnchanged} unchanged (non-EXPECTED — skipped).`
  )
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Fatal error:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
