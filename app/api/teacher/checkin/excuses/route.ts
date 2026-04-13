import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { verifyTeacherToken } from '@/lib/auth/teacher-session'
import { ActionError } from '@/lib/errors/action-error'
import { PHASE2_EXCUSE_ENABLED } from '@/lib/feature-flags'
import { createServiceLogger, logError } from '@/lib/logger'
import { submitExcuse } from '@/lib/services/dugsi/excuse-service'

const logger = createServiceLogger('teacher-excuses-route')

const BodySchema = z.object({
  attendanceRecordId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
})

export async function POST(req: NextRequest) {
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

  const body: unknown = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { attendanceRecordId, reason } = parsed.data

  try {
    const excuse = await submitExcuse({ attendanceRecordId, teacherId, reason })
    revalidatePath('/teacher/checkin')

    return NextResponse.json({ excuseRequestId: excuse.id })
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    await logError(logger, error, 'submitExcuse failed', {
      attendanceRecordId,
      teacherId,
    })
    return NextResponse.json(
      { error: 'Failed to submit excuse. Please try again.' },
      { status: 500 }
    )
  }
}
