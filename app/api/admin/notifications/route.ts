import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth'

/**
 * Notifications API Route
 *
 * NOTE: The redis mock doesn't have lrange implemented.
 * This endpoint is stubbed until notifications feature is properly set up.
 */
export async function GET() {
  await assertAdmin()
  return NextResponse.json([])
}
