import { NextRequest, NextResponse } from 'next/server'

import { Shift } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'

import { SCHOOL_TIMEZONE } from '@/lib/constants/teacher-checkin'
import {
  getTeacherCheckin,
  getTeacherShifts,
} from '@/lib/db/queries/teacher-checkin'
import type { TeacherContextDto } from '@/lib/features/attendance/contracts'

const schema = z.object({ teacherId: z.string().uuid() })

export async function GET(req: NextRequest) {
  const parsed = schema.safeParse({
    teacherId: req.nextUrl.searchParams.get('teacherId'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid teacherId' }, { status: 400 })
  }

  const { teacherId } = parsed.data
  const todayDate = formatInTimeZone(new Date(), SCHOOL_TIMEZONE, 'yyyy-MM-dd')
  const dateOnly = new Date(`${todayDate}T00:00:00Z`)

  try {
    const [shifts, morningCheckin, afternoonCheckin] = await Promise.all([
      getTeacherShifts(teacherId),
      getTeacherCheckin(teacherId, dateOnly, Shift.MORNING),
      getTeacherCheckin(teacherId, dateOnly, Shift.AFTERNOON),
    ])

    const dto: TeacherContextDto = {
      teacherId,
      todayDate,
      shifts,
      morningCheckinId: morningCheckin?.id ?? null,
      morningClockInTime: morningCheckin?.clockInTime.toISOString() ?? null,
      morningClockOutTime: morningCheckin?.clockOutTime?.toISOString() ?? null,
      afternoonCheckinId: afternoonCheckin?.id ?? null,
      afternoonClockInTime: afternoonCheckin?.clockInTime.toISOString() ?? null,
      afternoonClockOutTime:
        afternoonCheckin?.clockOutTime?.toISOString() ?? null,
      sessionToken: null,
    }

    return NextResponse.json(dto)
  } catch {
    return NextResponse.json(
      { error: 'Failed to load teacher context' },
      { status: 500 }
    )
  }
}
