/**
 * Auto-mark Cron Route
 *
 * Called by Vercel Cron every 15 minutes.
 * Marks EXPECTED attendance records as LATE once the window has passed.
 * Safe to call multiple times — service is idempotent.
 *
 * Auth: Vercel validates CRON_SECRET automatically in production.
 * In development, set CRON_SECRET env var and pass: Authorization: Bearer <secret>
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger } from '@/lib/logger'
import { autoMarkBothShifts } from '@/lib/services/dugsi/auto-mark-service'

const logger = createServiceLogger('cron-auto-mark')

export async function GET() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  // Vercel injects the CRON_SECRET automatically in production.
  // In development, pass it manually: Authorization: Bearer <CRON_SECRET>
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStr = formatInTimeZone(now, SCHOOL_TIMEZONE, 'yyyy-MM-dd')

  // Only run on weekends (school runs Sat + Sun only).
  // Use T12:00:00Z + getUTCDay() to avoid local-timezone ambiguity on the server.
  const dayOfWeek = new Date(`${todayStr}T12:00:00Z`).getUTCDay()
  if (dayOfWeek !== 0 && dayOfWeek !== 6) {
    return NextResponse.json({ skipped: 'not_a_school_day' })
  }

  try {
    const result = await autoMarkBothShifts(todayStr)

    logger.info(
      { event: 'CRON_AUTO_MARK_COMPLETE', date: todayStr, ...result },
      'Auto-mark cron completed'
    )

    return NextResponse.json({
      date: todayStr,
      morning: result.morning,
      afternoon: result.afternoon,
    })
  } catch (error) {
    logger.error({ err: error }, 'Auto-mark cron failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
