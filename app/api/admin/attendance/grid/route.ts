import { NextRequest, NextResponse } from 'next/server'

import { Shift } from '@prisma/client'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/assert-admin'
import {
  getCheckinsForDate,
  getCheckinHistory,
} from '@/lib/db/queries/teacher-checkin'
import type { AdminAttendanceGridDto } from '@/lib/features/attendance/contracts'
import { mapCheckinToDto } from '@/lib/features/attendance/mappers'

const schema = z.object({
  date: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  dateFrom: z.coerce.date().optional(),
  shift: z.nativeEnum(Shift).optional(),
  teacherId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(req: NextRequest) {
  try {
    await assertAdmin('admin-attendance-grid')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filters' }, { status: 400 })
  }

  const { date, dateTo, dateFrom, shift, teacherId, page, pageSize } =
    parsed.data

  try {
    if (dateFrom !== undefined) {
      const result = await getCheckinHistory(
        { dateFrom, dateTo, shift, teacherId },
        { page, limit: pageSize }
      )
      const dto: AdminAttendanceGridDto = {
        data: result.data.map(mapCheckinToDto),
        total: result.total,
        page: result.page,
        pageSize: result.limit,
        totalPages: result.totalPages,
      }
      return NextResponse.json(dto)
    }

    const checkins = await getCheckinsForDate({
      date,
      dateTo,
      shift,
      teacherId,
    })
    const dto: AdminAttendanceGridDto = {
      data: checkins.map(mapCheckinToDto),
      total: checkins.length,
      page: 1,
      pageSize: checkins.length || 1,
      totalPages: 1,
    }
    return NextResponse.json(dto)
  } catch {
    return NextResponse.json(
      { error: 'Failed to load attendance grid' },
      { status: 500 }
    )
  }
}
