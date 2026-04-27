import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/assert-admin'
import { mapCheckinToDto } from '@/lib/features/attendance/mappers'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  deleteCheckin,
  updateCheckin,
} from '@/lib/services/dugsi/teacher-checkin-service'
import { ValidationError } from '@/lib/services/validation-service'

const logger = createServiceLogger('admin-checkins-route')

const updateBodySchema = z
  .object({
    clockInTime: z.coerce.date().optional(),
    clockOutTime: z.coerce.date().nullable().optional(),
    isLate: z.boolean().optional(),
    clockInValid: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.clockOutTime && data.clockInTime) {
        return new Date(data.clockOutTime) > new Date(data.clockInTime)
      }
      return true
    },
    {
      message: 'Clock out time must be after clock in time',
      path: ['clockOutTime'],
    }
  )

function revalidateCheckinPaths() {
  revalidatePath('/admin/dugsi/teachers')
  revalidatePath('/admin/dugsi/teachers/attendance')
  revalidatePath('/teacher/checkin')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAdmin('admin-update-checkin')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body: unknown = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = updateBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  try {
    const updated = await updateCheckin({ checkInId: id, ...parsed.data })
    revalidateCheckinPaths()
    logger.info({ checkInId: id }, 'Check-in updated by admin')
    return NextResponse.json(mapCheckinToDto(updated))
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    await logError(logger, error, 'updateCheckin failed', { checkInId: id })
    return NextResponse.json(
      { error: 'Failed to update check-in' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAdmin('admin-delete-checkin')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteCheckin(id, 'admin')
    revalidateCheckinPaths()
    logger.info({ checkInId: id }, 'Check-in deleted by admin')
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    await logError(logger, error, 'deleteCheckin failed', { checkInId: id })
    return NextResponse.json(
      { error: 'Failed to delete check-in' },
      { status: 500 }
    )
  }
}
