/**
 * Auto-mark Cron Route
 *
 * Called by Vercel Cron once per day at 21:00 UTC on weekends (Sat + Sun).
 * 21:00 UTC = 3 PM CST / 4 PM CDT — after both shift thresholds have passed.
 * Marks EXPECTED attendance records as LATE once the window has passed.
 * Safe to call multiple times — service is idempotent (skips if window not yet passed).
 *
 * Note: Vercel hobby plan only supports daily cron jobs (once per day max).
 *
 * Auth: Vercel cron jobs send CRON_SECRET in the Authorization header.
 * The application validates it on every request (line 32). In development,
 * set CRON_SECRET env var and pass: Authorization: Bearer <secret>
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger, logError } from '@/lib/logger'
import { autoMarkBothShifts } from '@/lib/services/dugsi/auto-mark-service'

const logger = createServiceLogger('cron-auto-mark')

export async function GET() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

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
    logError(logger, error, 'Auto-mark cron failed', { date: todayStr })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
