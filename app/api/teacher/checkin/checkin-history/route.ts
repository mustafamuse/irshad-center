import { NextRequest, NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'

import { verifyTeacherToken } from '@/lib/auth/teacher-session'
import { SCHOOL_TIMEZONE } from '@/lib/constants/teacher-checkin'
import {
  getTeacherAttendanceSummary,
  getMonthlyExcusedCount,
} from '@/lib/db/queries/teacher-attendance'
import { PHASE2_EXCUSE_ENABLED } from '@/lib/feature-flags'
import type { TeacherCheckinHistoryDto } from '@/lib/features/attendance/contracts'
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('teacher-checkin-history-route')

const WEEKS_BACK = 8

export async function GET(req: NextRequest) {
  if (!PHASE2_EXCUSE_ENABLED) {
    return NextResponse.json(
      { error: 'This feature is not available yet' },
      { status: 403 }
    )
  }

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json(
      { error: 'Authorization required' },
      { status: 401 }
    )
  }

  const teacherId = verifyTeacherToken(token)
  if (!teacherId) {
    return NextResponse.json(
      { error: 'Session expired. Please refresh and try again.' },
      { status: 401 }
    )
  }

  try {
    const todayInTz = formatInTimeZone(
      new Date(),
      SCHOOL_TIMEZONE,
      'yyyy-MM-dd'
    )
    const [year, month] = todayInTz.split('-').map(Number) as [number, number]
    const todayAnchor = new Date(`${todayInTz}T12:00:00Z`)
    const from = new Date(`${todayInTz}T00:00:00Z`)
    from.setUTCDate(from.getUTCDate() - WEEKS_BACK * 7)

    const [records, monthlyExcuseCount] = await Promise.all([
      getTeacherAttendanceSummary(teacherId, from, todayAnchor),
      getMonthlyExcusedCount(teacherId, year, month),
    ])

    const dto: TeacherCheckinHistoryDto = {
      records: records.map((r) => ({
        id: r.id,
        date: formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd'),
        shift: r.shift,
        status: r.status,
        source: r.source,
        minutesLate: r.minutesLate,
        clockInTime: r.clockInTime?.toISOString() ?? null,
        pendingExcuseId:
          r.excuses.find((e) => e.status === 'PENDING')?.id ?? null,
        wasExcuseRejected:
          !r.excuses.some(
            (e) => e.status === 'PENDING' || e.status === 'APPROVED'
          ) && r.excuses.some((e) => e.status === 'REJECTED'),
      })),
      monthlyExcuseCount,
    }

    return NextResponse.json(dto)
  } catch (error) {
    await logError(logger, error, 'fetchAttendanceHistory failed', {
      teacherId,
    })
    return NextResponse.json(
      { error: 'Failed to load attendance history' },
      { status: 500 }
    )
  }
}
