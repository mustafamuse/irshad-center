import { NextResponse } from 'next/server'

/**
 * All Students for Siblings API Route
 *
 * NOTE: The Student model no longer exists in the schema.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Siblings API needs migration to new schema.' },
    { status: 501 }
  )
}
