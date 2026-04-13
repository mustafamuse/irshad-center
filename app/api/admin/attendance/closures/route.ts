import { NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/assert-admin'
import { listSchoolClosures } from '@/lib/db/queries/teacher-attendance'
import type { ClosureDto } from '@/lib/features/attendance/contracts'
import {
  markDateClosed,
  removeClosure,
} from '@/lib/services/dugsi/school-closure-service'
import {
  MarkDateClosedSchema,
  RemoveClosureSchema,
} from '@/lib/validations/teacher-attendance'

const ADMIN_IDENTITY = 'admin'

const MonthParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM')
  .optional()

function mapClosure(c: { id: string; date: Date; reason: string }): ClosureDto {
  return {
    id: c.id,
    date: formatInTimeZone(c.date, 'UTC', 'yyyy-MM-dd'),
    reason: c.reason,
  }
}

export async function GET(request: Request) {
  try {
    await assertAdmin('admin-attendance-closures-get')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const monthParse = MonthParamSchema.safeParse(
    searchParams.get('month') ?? undefined
  )
  if (!monthParse.success) {
    return NextResponse.json(
      { error: 'Invalid month parameter' },
      { status: 400 }
    )
  }

  let from: Date | undefined
  let to: Date | undefined
  if (monthParse.data) {
    const [year, month] = monthParse.data.split('-').map(Number)
    from = new Date(Date.UTC(year, month - 1, 1))
    to = new Date(Date.UTC(year, month, 1))
  }

  try {
    const closures = await listSchoolClosures(from, to)
    return NextResponse.json(closures.map(mapClosure))
  } catch {
    return NextResponse.json(
      { error: 'Failed to load closures' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await assertAdmin('admin-attendance-closures-post')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MarkDateClosedSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  try {
    const { closure } = await markDateClosed({
      date: new Date(parsed.data.date),
      reason: parsed.data.reason,
      createdBy: ADMIN_IDENTITY,
    })
    return NextResponse.json(mapClosure(closure))
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Failed to mark date closed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await assertAdmin('admin-attendance-closures-delete')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = RemoveClosureSchema.safeParse({
    date: searchParams.get('date'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid date' },
      { status: 400 }
    )
  }

  try {
    const { reopenedCount } = await removeClosure({
      date: new Date(parsed.data.date),
      changedBy: ADMIN_IDENTITY,
    })
    return NextResponse.json({ ok: true, reopenedCount })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove closure'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
