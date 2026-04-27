import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { generateTeacherToken } from '@/lib/auth/teacher-session'
import { isTeacherEnrolledInDugsi } from '@/lib/db/queries/teacher-checkin'
import { PHASE2_EXCUSE_ENABLED } from '@/lib/feature-flags'
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('teacher-session-route')

const BodySchema = z.object({
  teacherId: z.string().uuid(),
  pin: z.string().min(1),
})

export async function POST(req: NextRequest) {
  if (!PHASE2_EXCUSE_ENABLED) {
    return NextResponse.json(
      { error: 'Feature not available' },
      { status: 403 }
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

  const { teacherId, pin } = parsed.data
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { success } = await checkRateLimit(`session:${ip}:${teacherId}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  if (!process.env.TEACHER_CHECKIN_PIN) {
    await logError(
      logger,
      new Error('TEACHER_CHECKIN_PIN environment variable is not configured'),
      'Server misconfiguration',
      {}
    )
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    )
  }

  try {
    const enrolled = await isTeacherEnrolledInDugsi(teacherId)
    if (!enrolled) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 401 })
    }

    if (pin !== process.env.TEACHER_CHECKIN_PIN) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    return NextResponse.json({ token: generateTeacherToken(teacherId) })
  } catch (error) {
    await logError(logger, error, 'Failed to create session', { teacherId })
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
