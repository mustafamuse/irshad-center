import { NextResponse } from 'next/server'

/**
 * Profit Share API Route
 *
 * NOTE: This route needs migration to the new ProgramProfile-based schema.
 * The Student model no longer exists in the schema.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Profit Share API needs migration to new schema. See PR 2e.',
      message: 'This endpoint is temporarily disabled during schema migration.',
    },
    { status: 501 }
  )
}
