import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { clockOut } from '@/lib/services/dugsi/teacher-checkin-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ClockOutSchema } from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-clock-out-route')

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = ClockOutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { teacherId, checkInId } = parsed.data

  const { success } = await checkRateLimit(`clock-out:${checkInId}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    await clockOut(parsed.data)
    revalidatePath('/teacher/checkin')
    revalidatePath('/admin/dugsi/teacher-checkins')

    return NextResponse.json({ message: 'Clocked out successfully' })
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
    await logError(logger, error, 'Clock-out failed', { teacherId, checkInId })
    return NextResponse.json(
      { error: 'Failed to clock out. Please try again.' },
      { status: 500 }
    )
  }
}
