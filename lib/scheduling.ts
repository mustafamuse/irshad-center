import { DayOfWeek } from '@prisma/client'
import { add, set, format, parse } from 'date-fns'

import { prisma } from '@/lib/db'

/**
 * A map to convert Prisma's DayOfWeek enum to a number compatible with date-fns (0=Sunday, 6=Saturday).
 */
const dayOfWeekToDateFnsDay: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

/**
 * Generates all class sessions for a given class schedule within its semester dates.
 * This function is idempotent: it first deletes all existing sessions for the schedule
 * before generating new ones. This has been updated to only affect sessions from
 * today onwards, preserving past attendance data.
 *
 * @param classScheduleId The ID of the class schedule for which to generate sessions.
 * @returns An object containing the count of created sessions.
 */
export async function generateClassSessionsForSchedule(
  classScheduleId: string
) {
  const classSchedule = await prisma.classSchedule.findUnique({
    where: { id: classScheduleId },
    include: { semester: true },
  })

  if (!classSchedule) {
    throw new Error(`Class schedule with ID ${classScheduleId} not found.`)
  }

  const { semester, daysOfWeek, startTime, endTime } = classSchedule
  const scheduledDays = daysOfWeek.map((day) => dayOfWeekToDateFnsDay[day])

  // Use Date.UTC for timezone-safe date creation
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const s = semester.startDate
  const semesterStartDate = new Date(
    Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())
  )

  const startDateForGeneration =
    today > semesterStartDate ? today : semesterStartDate

  // Make the function idempotent by cleaning up future sessions first.
  await prisma.classSession.deleteMany({
    where: {
      classScheduleId: classScheduleId,
      date: {
        gte: startDateForGeneration,
      },
    },
  })

  let currentDay = startDateForGeneration
  const createdSessions = []

  const parsedStartTime = parse(startTime, 'HH:mm', new Date())
  const parsedEndTime = parse(endTime, 'HH:mm', new Date())

  const e = semester.endDate
  const semesterEndDate = new Date(
    Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())
  )

  while (currentDay <= semesterEndDate) {
    if (scheduledDays.includes(currentDay.getUTCDay())) {
      const sessionDate = currentDay

      // Combine the date with the start and end times
      const sessionStartTime = set(sessionDate, {
        hours: parsedStartTime.getHours(),
        minutes: parsedStartTime.getMinutes(),
        seconds: 0,
        milliseconds: 0,
      })

      const sessionEndTime = set(sessionDate, {
        hours: parsedEndTime.getHours(),
        minutes: parsedEndTime.getMinutes(),
        seconds: 0,
        milliseconds: 0,
      })

      const newSession = await prisma.classSession.create({
        data: {
          classScheduleId: classScheduleId,
          date: sessionDate,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          // Attendance records can be pre-generated here if desired
        },
      })
      createdSessions.push(newSession)
    }
    currentDay = add(currentDay, { days: 1 })
  }

  console.log(
    `✅ Created ${createdSessions.length} sessions for schedule ${classScheduleId} from ${format(
      semesterStartDate,
      'MM/dd/yyyy'
    )} to ${format(semesterEndDate, 'MM/dd/yyyy')}.`
  )

  return {
    count: createdSessions.length,
    sessions: createdSessions,
  }
}

/**
 * Updates a single, specific class session.
 * Ideal for one-off changes like moving a single class to a different day or time.
 *
 * @param classSessionId The ID of the session to update.
 * @param updates An object with the fields to change (e.g., { date: newDate, startTime: newTime }).
 */
export async function updateClassSession(
  classSessionId: string,
  updates: {
    date?: Date
    startTime?: Date
    endTime?: Date
    notes?: string
  }
) {
  const updatedSession = await prisma.classSession.update({
    where: { id: classSessionId },
    data: updates,
  })

  console.log(`✅ Updated session ${classSessionId} with new data.`)
  return updatedSession
}
