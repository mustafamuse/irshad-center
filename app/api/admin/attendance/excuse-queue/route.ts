import { NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/assert-admin'
import { getPendingExcuseRequests } from '@/lib/db/queries/teacher-attendance'
import type { ExcuseQueueItemDto } from '@/lib/features/attendance/contracts'
import {
  approveExcuse,
  rejectExcuse,
} from '@/lib/services/dugsi/excuse-service'

const ADMIN_IDENTITY = 'admin'

const ReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  excuseRequestId: z.string().uuid(),
  adminNote: z.string().max(500).optional(),
})

function mapExcuseRequest(
  req: Awaited<ReturnType<typeof getPendingExcuseRequests>>[number]
): ExcuseQueueItemDto {
  const record = req.attendanceRecord
  return {
    id: req.id,
    attendanceRecordId: req.attendanceRecordId,
    teacherName: record.teacher.person.name,
    date: formatInTimeZone(record.date, 'UTC', 'yyyy-MM-dd'),
    shift: record.shift,
    recordStatus: record.status,
    reason: req.reason,
    createdAt: req.createdAt.toISOString(),
  }
}

export async function GET() {
  try {
    await assertAdmin('admin-attendance-excuse-queue-get')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requests = await getPendingExcuseRequests()
    return NextResponse.json(requests.map(mapExcuseRequest))
  } catch {
    return NextResponse.json(
      { error: 'Failed to load excuse queue' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await assertAdmin('admin-attendance-excuse-queue-patch')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { action, excuseRequestId, adminNote } = parsed.data

  try {
    if (action === 'approve') {
      await approveExcuse({
        excuseRequestId,
        adminNote,
        reviewedBy: ADMIN_IDENTITY,
      })
    } else {
      await rejectExcuse({
        excuseRequestId,
        adminNote,
        reviewedBy: ADMIN_IDENTITY,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : `Failed to ${action} excuse request`
    const status = (err as { status?: number }).status ?? 400
    return NextResponse.json({ error: msg }, { status })
  }
}
