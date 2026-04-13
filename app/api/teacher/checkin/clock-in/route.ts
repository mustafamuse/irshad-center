import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { clockIn } from '@/lib/services/dugsi/teacher-checkin-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ClockInSchema } from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-clock-in-route')

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = ClockInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { teacherId, shift } = parsed.data

  const { success } = await checkRateLimit(`clock-in:${teacherId}:${shift}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const result = await clockIn(parsed.data)
    revalidatePath('/teacher/checkin')
    revalidatePath('/admin/dugsi/teacher-checkins')

    return NextResponse.json({
      checkInId: result.checkIn.id,
      message: result.checkIn.isLate
        ? 'Clocked in (Late)'
        : 'Clocked in successfully',
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (error instanceof ActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    await logError(logger, error, 'Clock-in failed', { teacherId, shift })
    return NextResponse.json(
      { error: 'Failed to clock in. Please try again.' },
      { status: 500 }
    )
  }
}
