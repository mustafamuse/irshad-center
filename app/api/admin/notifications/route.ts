import { NextResponse } from 'next/server'

/**
 * Notifications API Route
 *
 * NOTE: The redis mock doesn't have lrange implemented.
 * This endpoint is stubbed until notifications feature is properly set up.
 */
export async function GET() {
  // Return empty notifications array
  return NextResponse.json([])
}
