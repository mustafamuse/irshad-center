import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/assert-admin'
import { getCheckinHistory } from '@/lib/db/queries/teacher-checkin'
import type { AdminAttendanceGridDto } from '@/lib/features/attendance/contracts'
import { mapCheckinToDto } from '@/lib/features/attendance/mappers'

const schema = z.object({
  teacherId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
})

const LIMIT = 10
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    await assertAdmin('admin-checkin-history')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse({
    teacherId: req.nextUrl.searchParams.get('teacherId'),
    page: req.nextUrl.searchParams.get('page'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const { teacherId, page } = parsed.data
  const dateFrom = new Date(Date.now() - THIRTY_DAYS_MS)

  try {
    const result = await getCheckinHistory(
      { teacherId, dateFrom },
      { page, limit: LIMIT }
    )
    const dto: AdminAttendanceGridDto = {
      data: result.data.map(mapCheckinToDto),
      total: result.total,
      page: result.page,
      pageSize: result.limit,
      totalPages: result.totalPages,
    }
    return NextResponse.json(dto)
  } catch {
    return NextResponse.json(
      { error: 'Failed to load check-in history' },
      { status: 500 }
    )
  }
}
