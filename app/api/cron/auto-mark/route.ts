/**
 * Auto-mark Cron Route
 *
 * Called by Vercel Cron once per day at 21:00 UTC on weekends (Sat + Sun).
 * 21:00 UTC = 3 PM CST / 4 PM CDT — after both shift thresholds have passed.
 * Marks EXPECTED attendance records as LATE once the window has passed.
 * Safe to call multiple times — service is idempotent (skips if window not yet passed).
 *
 * Auth: Vercel cron jobs send CRON_SECRET in the Authorization header.
 * In development,
 * set CRON_SECRET env var and pass: Authorization: Bearer <secret>
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'
import crypto from 'node:crypto'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { createServiceLogger, logError } from '@/lib/logger'
import { autoMarkBothShifts } from '@/lib/services/dugsi/auto-mark-service'

const logger = createServiceLogger('cron-auto-mark')

// Vercel Fluid Compute: allow up to 60 s for the transaction across all teachers.
// Default is 10 s on hobby plans; auto-mark opens a write transaction that can
// take several seconds on a cold connection with many teachers.
export const maxDuration = 60

export async function GET() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error(
      { event: 'CRON_SECRET_MISSING' },
      'CRON_SECRET env var is not set — auto-mark cron will not run'
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Hash both sides to a fixed-length digest before comparing so that
  // timingSafeEqual is always called on equal-length inputs — no length
  // short-circuit, and the expected token length is never leaked via timing.
  const expectedHash = crypto
    .createHash('sha256')
    .update(`Bearer ${cronSecret}`)
    .digest()
  const receivedHash = crypto
    .createHash('sha256')
    .update(authHeader ?? '')
    .digest()
  const valid = crypto.timingSafeEqual(expectedHash, receivedHash)
  if (!valid) {
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

    // 207 when one shift failed (null): Vercel Cron treats any 2xx as success, so a
    // 200 with a null shift would be invisible in the cron dashboard. 207 surfaces the
    // partial failure in any monitor keying on HTTP status while still counting as
    // "completed" (not a dead 500) for the working shift.
    return NextResponse.json(
      {
        date: todayStr,
        morning: result.morning,
        afternoon: result.afternoon,
      },
      { status: result.morning && result.afternoon ? 200 : 207 }
    )
  } catch (error) {
    await logError(
      logger,
      error,
      'Auto-mark cron failed — both shifts errored',
      { date: todayStr }
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
