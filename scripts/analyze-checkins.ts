import { Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { prisma } from '@/lib/db'
import { evaluateCheckIn } from '@/lib/utils/evaluate-checkin'

type ConfidenceBucket =
  | 'ON_TIME'
  | 'LATE'
  | 'STORED_MISMATCH'
  | 'MISSING_EXPECTED'
  | 'EXCLUDED'

interface ClassifiedCheckin {
  teacherId: string
  teacherName: string
  date: string
  shift: Shift
  bucket: ConfidenceBucket
  minutesLate: number
  storedIsLate: boolean | null
  recalculatedIsLate: boolean | null
}

interface TeacherInfo {
  id: string
  name: string
  shifts: Shift[]
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  weeks: number
  teacherFilter: string | null
  shiftFilter: Shift | null
  excludeDates: Set<string>
} {
  const args = process.argv.slice(2)
  let weeks = 4
  let teacherFilter: string | null = null
  let shiftFilter: Shift | null = null
  const excludeDates = new Set<string>()

  const KNOWN_FLAGS = new Set(['--weeks', '--teacher', '--shift', '--exclude'])

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--weeks') {
      if (!args[i + 1]) { console.error('--weeks requires a value'); process.exit(1) }
      weeks = parseInt(args[i + 1], 10)
      if (isNaN(weeks) || weeks < 1 || weeks > 52) {
        console.error('--weeks must be between 1 and 52')
        process.exit(1)
      }
      i++
    } else if (arg === '--teacher') {
      if (!args[i + 1]) { console.error('--teacher requires a value'); process.exit(1) }
      teacherFilter = args[i + 1]
      i++
    } else if (arg === '--shift') {
      if (!args[i + 1]) { console.error('--shift requires a value'); process.exit(1) }
      const val = args[i + 1].toUpperCase()
      if (val !== 'MORNING' && val !== 'AFTERNOON') {
        console.error('--shift must be MORNING or AFTERNOON')
        process.exit(1)
      }
      shiftFilter = val as Shift
      i++
    } else if (arg === '--exclude') {
      if (!args[i + 1]) { console.error('--exclude requires a value'); process.exit(1) }
      const dateArg = args[i + 1]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
        console.error(`--exclude must be a YYYY-MM-DD date, got: ${dateArg}`)
        process.exit(1)
      }
      excludeDates.add(dateArg)
      i++
    } else if (arg.startsWith('--') && !KNOWN_FLAGS.has(arg)) {
      console.error(`Unknown argument: ${arg}`)
      console.error('Usage: analyze-checkins [--weeks N] [--teacher NAME] [--shift MORNING|AFTERNOON] [--exclude YYYY-MM-DD]')
      process.exit(1)
    }
  }

  return { weeks, teacherFilter, shiftFilter, excludeDates }
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

function getWeekendDatesInRange(weeksBack: number): string[] {
  const now = new Date()
  const todayStr = formatInTimeZone(now, SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  // Local noon: getDay()/getDate() use local time, and noon never rolls to a different calendar day
  const today = new Date(todayStr + 'T12:00:00')

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - weeksBack * 7)

  const dates: string[] = []
  const cursor = new Date(startDate)

  while (cursor <= today) {
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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${dayNames[d.getDay()]} ${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')}`
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getActiveTeachers(
  teacherFilter: string | null
): Promise<TeacherInfo[]> {
  const teacherPrograms = await prisma.teacherProgram.findMany({
    where: {
      program: 'DUGSI_PROGRAM',
      isActive: true,
    },
    include: {
      teacher: {
        include: { person: true },
      },
    },
  })

  let teachers: TeacherInfo[] = teacherPrograms
    .map((tp) => ({
      id: tp.teacherId,
      name: tp.teacher.person.name,
      shifts: tp.shifts,
    }))
    .filter((t) => t.shifts.length > 0)

  if (teacherFilter) {
    const lower = teacherFilter.toLowerCase()
    teachers = teachers.filter((t) => t.name.toLowerCase().includes(lower))
  }

  return teachers.sort((a, b) => a.name.localeCompare(b.name))
}

async function getCheckins(
  dateFrom: string,
  dateTo: string,
  teacherIds: string[]
) {
  if (teacherIds.length === 0) return []

  return prisma.dugsiTeacherCheckIn.findMany({
    where: {
      teacherId: { in: teacherIds },
      // @db.Date column: Prisma compares at the date level, UTC midnight is safe
      date: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
    },
    include: {
      teacher: {
        include: { person: true },
      },
    },
    orderBy: [{ date: 'asc' }, { shift: 'asc' }],
  })
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classifyCheckins(
  teachers: TeacherInfo[],
  weekendDates: string[],
  checkins: Awaited<ReturnType<typeof getCheckins>>,
  shiftFilter: Shift | null,
  excludeDates: Set<string>
): ClassifiedCheckin[] {
  const checkinMap = new Map<string, (typeof checkins)[number]>()
  for (const c of checkins) {
    // Prisma returns @db.Date as UTC midnight; UTC formatting yields the correct date string
    const dateStr = formatInTimeZone(c.date, 'UTC', 'yyyy-MM-dd')
    const key = `${c.teacherId}|${dateStr}|${c.shift}`
    checkinMap.set(key, c)
  }

  const results: ClassifiedCheckin[] = []

  for (const teacher of teachers) {
    const shifts = shiftFilter
      ? teacher.shifts.filter((s) => s === shiftFilter)
      : teacher.shifts

    for (const date of weekendDates) {
      for (const shift of shifts) {
        const key = `${teacher.id}|${date}|${shift}`
        const checkin = checkinMap.get(key)

        if (excludeDates.has(date)) {
          results.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            date,
            shift,
            bucket: 'EXCLUDED',
            minutesLate: 0,
            storedIsLate: null,
            recalculatedIsLate: null,
          })
          continue
        }

        if (!checkin) {
          results.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            date,
            shift,
            bucket: 'MISSING_EXPECTED',
            minutesLate: 0,
            storedIsLate: null,
            recalculatedIsLate: null,
          })
          continue
        }

        const { isLate: recalcLate, minutesLate } = evaluateCheckIn({ clockInTimeUtc: checkin.clockInTime, shift })

        if (checkin.isLate !== recalcLate) {
          results.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            date,
            shift,
            bucket: 'STORED_MISMATCH',
            minutesLate,
            storedIsLate: checkin.isLate,
            recalculatedIsLate: recalcLate,
          })
        } else if (recalcLate) {
          results.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            date,
            shift,
            bucket: 'LATE',
            minutesLate,
            storedIsLate: checkin.isLate,
            recalculatedIsLate: recalcLate,
          })
        } else {
          results.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            date,
            shift,
            bucket: 'ON_TIME',
            minutesLate: 0,
            storedIsLate: checkin.isLate,
            recalculatedIsLate: false,
          })
        }
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(
  results: ClassifiedCheckin[],
  weekendDates: string[],
  teachers: TeacherInfo[],
  excludeDates: Set<string>
) {
  const sep = '='.repeat(60)

  const onTime = results.filter((r) => r.bucket === 'ON_TIME')
  const late = results.filter((r) => r.bucket === 'LATE')
  const mismatches = results.filter((r) => r.bucket === 'STORED_MISMATCH')
  const missing = results.filter((r) => r.bucket === 'MISSING_EXPECTED')
  const excluded = results.filter((r) => r.bucket === 'EXCLUDED')

  const totalExpected = results.length - excluded.length

  // Summary
  console.log(`\n${sep}`)
  console.log('  DUGSI TEACHER CHECK-IN ANALYSIS')
  console.log(sep)
  console.log(
    `Period: ${formatDateShort(weekendDates[0])} - ${formatDateShort(weekendDates[weekendDates.length - 1])}, ${weekendDates[weekendDates.length - 1].slice(0, 4)}`
  )
  console.log(
    `Weekend days: ${weekendDates.length} | Teachers: ${teachers.length} active`
  )
  console.log(`Expected check-ins: ${totalExpected}`)
  if (excluded.length > 0) {
    console.log(`Excluded dates: ${excludeDates.size} (${excluded.length} check-ins excluded)`)
  }
  console.log()
  console.log(
    `  On-time:     ${String(onTime.length).padStart(4)} (${pct(onTime.length, totalExpected)})`
  )
  console.log(
    `  Late:        ${String(late.length + mismatches.filter((m) => m.recalculatedIsLate).length).padStart(4)} (${pct(late.length + mismatches.filter((m) => m.recalculatedIsLate).length, totalExpected)})`
  )
  console.log(
    `  Missing:     ${String(missing.length).padStart(4)} (${pct(missing.length, totalExpected)})  [provisional]`
  )

  // Stored vs Recalculated Mismatches
  if (mismatches.length > 0) {
    console.log(`\n${sep}`)
    console.log('  STORED vs RECALCULATED MISMATCHES')
    console.log(sep)
    console.log(
      'These check-ins have a stored isLate flag that disagrees with'
    )
    console.log('recalculation using the corrected shift deadlines.')
    console.log()
    console.log(
      padRight('Teacher', 20) +
        padRight('Date', 14) +
        padRight('Shift', 12) +
        padRight('Stored', 10) +
        'Recalculated'
    )
    console.log('-'.repeat(70))
    for (const m of mismatches) {
      const stored = m.storedIsLate ? 'LATE' : 'on-time'
      const recalc = m.recalculatedIsLate
        ? `LATE (${m.minutesLate} min)`
        : 'on-time'
      console.log(
        padRight(m.teacherName, 20) +
          padRight(formatDateShort(m.date), 14) +
          padRight(m.shift, 12) +
          padRight(stored, 10) +
          recalc
      )
    }
    console.log(`\nTotal mismatches: ${mismatches.length}`)
  }

  // Missing Expected Check-ins
  if (missing.length > 0) {
    console.log(`\n${sep}`)
    console.log('  MISSING EXPECTED CHECK-INS')
    console.log(sep)
    console.log(
      '(Provisional — teacher may not have been assigned on these dates)'
    )
    console.log()
    console.log(
      padRight('Teacher', 20) + padRight('Date', 14) + 'Shift'
    )
    console.log('-'.repeat(50))
    for (const m of missing) {
      console.log(
        padRight(m.teacherName, 20) +
          padRight(formatDateShort(m.date), 14) +
          m.shift
      )
    }

    const teachersWithGaps = new Set(missing.map((m) => m.teacherName))
    console.log(
      `\nTotal gaps: ${missing.length} across ${teachersWithGaps.size} teachers`
    )
  }

  // Tardiness Analysis
  const allLate = [...late, ...mismatches.filter((m) => m.recalculatedIsLate)]
  if (allLate.length > 0) {
    console.log(`\n${sep}`)
    console.log('  TARDINESS ANALYSIS')
    console.log(sep)

    const byTeacher = new Map<
      string,
      { late: number; total: number; totalMinutes: number }
    >()
    for (const r of results) {
      if (r.bucket === 'EXCLUDED') continue
      const key = r.teacherName
      if (!byTeacher.has(key)) {
        byTeacher.set(key, { late: 0, total: 0, totalMinutes: 0 })
      }
      const entry = byTeacher.get(key)!
      if (r.bucket !== 'MISSING_EXPECTED') {
        entry.total++
      }
    }
    for (const r of allLate) {
      const entry = byTeacher.get(r.teacherName)
      if (entry) {
        entry.late++
        entry.totalMinutes += r.minutesLate
      }
    }

    const sorted = Array.from(byTeacher.entries())
      .filter(([, v]) => v.late > 0)
      .sort((a, b) => b[1].late - a[1].late)

    console.log()
    console.log(
      padRight('Teacher', 20) +
        padRight('Late', 6) +
        padRight('Total', 7) +
        padRight('Rate', 8) +
        'Avg Late'
    )
    console.log('-'.repeat(55))
    for (const [name, stats] of sorted) {
      const avgMin =
        stats.late > 0 ? Math.round(stats.totalMinutes / stats.late) : 0
      console.log(
        padRight(name, 20) +
          padRight(String(stats.late), 6) +
          padRight(String(stats.total), 7) +
          padRight(pct(stats.late, stats.total), 8) +
          `${avgMin} min`
      )
    }

    // Distribution
    const brackets = [
      { label: '<1 min',    min: 0, max: 1 },
      { label: '1-5 min',  min: 1, max: 5 },
      { label: '5-10 min', min: 5, max: 10 },
      { label: '10-15 min', min: 10, max: 15 },
      { label: '15+ min',  min: 15, max: Infinity },
    ]
    console.log('\nDistribution:')
    for (const b of brackets) {
      const count = allLate.filter(
        (r) =>
          r.minutesLate >= b.min &&
          (b.max === Infinity ? true : r.minutesLate < b.max)
      ).length
      console.log(`  ${padRight(b.label + ':', 12)} ${count} (${pct(count, allLate.length)})`)
    }
  }

  // Per-Teacher Scorecard
  console.log(`\n${sep}`)
  console.log('  PER-TEACHER SCORECARD')
  console.log(sep)
  console.log()

  for (const teacher of teachers) {
    const teacherResults = results.filter(
      (r) => r.teacherId === teacher.id && r.bucket !== 'EXCLUDED'
    )
    if (teacherResults.length === 0) continue

    const present = teacherResults.filter(
      (r) =>
        r.bucket === 'ON_TIME' ||
        r.bucket === 'LATE' ||
        r.bucket === 'STORED_MISMATCH'
    ).length
    const lateCount = teacherResults.filter(
      (r) =>
        r.bucket === 'LATE' ||
        (r.bucket === 'STORED_MISMATCH' && r.recalculatedIsLate)
    ).length
    const missingCount = teacherResults.filter(
      (r) => r.bucket === 'MISSING_EXPECTED'
    ).length

    const shifts = teacher.shifts.join(' + ')
    console.log(`${teacher.name} (${shifts})`)
    console.log(
      `  Present: ${present}/${teacherResults.length} (${pct(present, teacherResults.length)})` +
        `  Late: ${lateCount}` +
        `  Missing: ${missingCount} [provisional]`
    )
  }

  console.log()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return (n / total * 100).toFixed(1) + '%'
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[READ-ONLY] Connecting to: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@') ?? 'unknown'}`)

  const { weeks, teacherFilter, shiftFilter, excludeDates } = parseArgs()

  const weekendDates = getWeekendDatesInRange(weeks)
  if (weekendDates.length === 0) {
    console.log('No weekend dates found in range.')
    return
  }

  const teachers = await getActiveTeachers(teacherFilter)
  if (teachers.length === 0) {
    console.log(
      teacherFilter
        ? `No active Dugsi teachers matching "${teacherFilter}".`
        : 'No active Dugsi teachers found.'
    )
    return
  }

  const teacherIds = teachers.map((t) => t.id)
  const checkins = await getCheckins(
    weekendDates[0],
    weekendDates[weekendDates.length - 1],
    teacherIds
  )

  const results = classifyCheckins(
    teachers,
    weekendDates,
    checkins,
    shiftFilter,
    excludeDates
  )

  printReport(results, weekendDates, teachers, excludeDates)
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Fatal error:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
