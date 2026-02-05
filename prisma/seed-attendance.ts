import { PrismaClient, DugsiAttendanceStatus } from '@prisma/client'
import { subDays, addDays, getDay, startOfDay } from 'date-fns'

const prisma = new PrismaClient()

const SEED_MARKER = '[SEED]'
const WEEKS = 12

const SURAHS = ['Al-Fatiha', 'Al-Baqarah', 'Al-Imran', 'An-Nisa', 'Al-Maidah']

function pickStatus(): DugsiAttendanceStatus {
  const r = Math.random()
  if (r < 0.7) return DugsiAttendanceStatus.PRESENT
  if (r < 0.8) return DugsiAttendanceStatus.LATE
  if (r < 0.95) return DugsiAttendanceStatus.ABSENT
  return DugsiAttendanceStatus.EXCUSED
}

function getWeekendDates(weeksAgo: number): { saturday: Date; sunday: Date } {
  const now = new Date()
  const dayOfWeek = getDay(now)
  let daysToSaturday: number
  if (dayOfWeek === 6) daysToSaturday = 0
  else if (dayOfWeek === 0) daysToSaturday = 1
  else daysToSaturday = dayOfWeek + 1

  const saturday = startOfDay(subDays(now, daysToSaturday + weeksAgo * 7))
  const sunday = startOfDay(addDays(saturday, 1))
  return { saturday, sunday }
}

function assertNotProduction() {
  const dbUrl = process.env.DATABASE_URL || ''
  if (dbUrl.includes('prod') || process.env.NODE_ENV === 'production') {
    console.error(
      'SAFETY CHECK FAILED: Cannot run seed scripts against production database'
    )
    process.exit(1)
  }
}

async function seedAttendance() {
  assertNotProduction()
  console.log('Starting attendance seed...\n')

  const existing = await prisma.dugsiAttendanceSession.count({
    where: { notes: SEED_MARKER },
  })
  if (existing > 0) {
    console.log(`Found ${existing} existing seeded sessions.`)
    console.log('Run "npm run unseed:attendance" first to clear them.\n')
    process.exit(1)
  }

  const classes = await prisma.dugsiClass.findMany({
    where: { isActive: true },
    include: {
      students: {
        where: { isActive: true },
        select: { programProfileId: true },
      },
      teachers: { where: { isActive: true }, select: { teacherId: true } },
    },
  })

  if (classes.length === 0) {
    console.log('No active classes found.')
    process.exit(1)
  }

  console.log(`Found ${classes.length} active classes:`)
  classes.forEach((c) => {
    console.log(
      `  - ${c.name} (${c.students.length} students, ${c.teachers.length} teachers)`
    )
  })
  console.log()

  const dates: Date[] = []
  for (let i = 0; i < WEEKS; i++) {
    const { saturday, sunday } = getWeekendDates(i)
    dates.push(saturday, sunday)
  }

  console.log(
    `Generating sessions for ${dates.length} days (${WEEKS} weekends)`
  )

  let sessionCount = 0
  let recordCount = 0

  for (const date of dates) {
    for (const cls of classes) {
      if (cls.teachers.length === 0 || cls.students.length === 0) continue

      const teacherId =
        cls.teachers[Math.floor(Math.random() * cls.teachers.length)].teacherId

      const session = await prisma.dugsiAttendanceSession
        .create({
          data: {
            date,
            classId: cls.id,
            teacherId,
            notes: SEED_MARKER,
            isClosed: true,
          },
        })
        .catch(() => null)

      if (!session) continue
      sessionCount++

      const records = cls.students.map((s) => {
        const status = pickStatus()
        const isAttending =
          status === DugsiAttendanceStatus.PRESENT ||
          status === DugsiAttendanceStatus.LATE
        const ayatFrom = Math.floor(Math.random() * 15) + 1
        return {
          sessionId: session.id,
          programProfileId: s.programProfileId,
          status,
          lessonCompleted: isAttending,
          surahName: isAttending
            ? SURAHS[Math.floor(Math.random() * SURAHS.length)]
            : null,
          ayatFrom: isAttending ? ayatFrom : null,
          ayatTo: isAttending
            ? ayatFrom + Math.floor(Math.random() * 5) + 1
            : null,
        }
      })

      const result = await prisma.dugsiAttendanceRecord.createMany({
        data: records,
        skipDuplicates: true,
      })
      recordCount += result.count
    }
  }

  console.log('\nSeed complete!')
  console.log(`  Sessions: ${sessionCount}`)
  console.log(`  Records: ${recordCount}`)
  console.log('\nTo remove seeded data, run: npm run unseed:attendance')
}

seedAttendance()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
