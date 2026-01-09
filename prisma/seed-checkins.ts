import { PrismaClient, Shift } from '@prisma/client'
import {
  subDays,
  addDays,
  setHours,
  setMinutes,
  getDay,
  startOfDay,
} from 'date-fns'

const prisma = new PrismaClient()

const SEED_MARKER = '[SEED]'

const SHIFT_CONFIG = {
  MORNING: {
    startHour: 8,
    startMinute: 30,
    endHour: 12,
    endMinute: 0,
  },
  AFTERNOON: {
    startHour: 14,
    startMinute: 0,
    endHour: 17,
    endMinute: 0,
  },
} as const

function getWeekendDates(weeksAgo: number): { saturday: Date; sunday: Date } {
  const now = new Date()
  const dayOfWeek = getDay(now)

  let daysToSaturday: number
  if (dayOfWeek === 6) {
    daysToSaturday = 0
  } else if (dayOfWeek === 0) {
    daysToSaturday = 1
  } else {
    daysToSaturday = dayOfWeek + 1
  }

  const saturday = startOfDay(subDays(now, daysToSaturday + weeksAgo * 7))
  const sunday = startOfDay(addDays(saturday, 1))

  return { saturday, sunday }
}

function generateWeekendDates(count: number): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const { saturday, sunday } = getWeekendDates(i)
    dates.push(saturday, sunday)
  }
  return dates
}

function generateClockInTime(date: Date, shift: Shift, isLate: boolean): Date {
  const config = SHIFT_CONFIG[shift]
  let clockIn = setHours(date, config.startHour)
  clockIn = setMinutes(clockIn, config.startMinute)

  if (isLate) {
    const lateMinutes = Math.floor(Math.random() * 20) + 5
    clockIn = new Date(clockIn.getTime() + lateMinutes * 60 * 1000)
  } else {
    const earlyMinutes = Math.floor(Math.random() * 15)
    clockIn = new Date(clockIn.getTime() - earlyMinutes * 60 * 1000)
  }

  return clockIn
}

function generateClockOutTime(date: Date, shift: Shift): Date {
  const config = SHIFT_CONFIG[shift]
  let clockOut = setHours(date, config.endHour)
  clockOut = setMinutes(clockOut, config.endMinute)

  const extraMinutes = Math.floor(Math.random() * 30) - 10
  clockOut = new Date(clockOut.getTime() + extraMinutes * 60 * 1000)

  return clockOut
}

async function seedCheckins() {
  console.log('Starting check-in seed...\n')

  const existingSeeded = await prisma.dugsiTeacherCheckIn.count({
    where: { notes: SEED_MARKER },
  })

  if (existingSeeded > 0) {
    console.log(`Found ${existingSeeded} existing seeded records.`)
    console.log('Run "npm run unseed:checkins" first to clear them.\n')
    process.exit(1)
  }

  const teachers = await prisma.teacher.findMany({
    include: { person: true },
  })

  if (teachers.length === 0) {
    console.log('No teachers found in the database.')
    process.exit(1)
  }

  console.log(`Found ${teachers.length} teachers:`)
  teachers.forEach((t) => console.log(`  - ${t.person.name}`))
  console.log()

  const weekendDates = generateWeekendDates(8)
  console.log(
    `Generating check-ins for ${weekendDates.length} days (8 weekends)`
  )
  console.log()

  let created = 0
  let skipped = 0

  for (const teacher of teachers) {
    for (const date of weekendDates) {
      for (const shift of [Shift.MORNING, Shift.AFTERNOON]) {
        const skipCheckin = Math.random() < 0.1
        if (skipCheckin) {
          skipped++
          continue
        }

        const isLate = Math.random() < 0.2
        const hasClockOut = Math.random() < 0.7

        try {
          await prisma.dugsiTeacherCheckIn.create({
            data: {
              teacherId: teacher.id,
              date: date,
              shift: shift,
              clockInTime: generateClockInTime(date, shift, isLate),
              clockInLat: 44.9537 + (Math.random() - 0.5) * 0.0001,
              clockInLng: -93.09 + (Math.random() - 0.5) * 0.0001,
              clockInValid: true,
              clockOutTime: hasClockOut
                ? generateClockOutTime(date, shift)
                : null,
              clockOutLat: hasClockOut
                ? 44.9537 + (Math.random() - 0.5) * 0.0001
                : null,
              clockOutLng: hasClockOut
                ? -93.09 + (Math.random() - 0.5) * 0.0001
                : null,
              isLate: isLate,
              notes: SEED_MARKER,
            },
          })
          created++
        } catch {
          skipped++
        }
      }
    }
  }

  console.log('Seed complete!')
  console.log(`  Created: ${created} check-in records`)
  console.log(`  Skipped: ${skipped} (random gaps or duplicates)`)
  console.log()
  console.log('To remove seeded data, run: npm run unseed:checkins')
}

seedCheckins()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
