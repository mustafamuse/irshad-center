import { NextResponse } from 'next/server'

/**
 * Export Data API Route
 *
 * NOTE: This route needs migration to the new ProgramProfile-based schema.
 * The Student and Sibling models no longer exist in the schema.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Export API needs migration to new schema. See PR 2e.',
      message: 'This endpoint is temporarily disabled during schema migration.',
    },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
