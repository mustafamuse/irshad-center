import { NextResponse } from 'next/server'

/**
 * Siblings API Routes
 *
 * NOTE: The Sibling model was replaced with SiblingRelationship in the new schema.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Siblings API needs migration to new schema.' },
    { status: 501 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Siblings API needs migration to new schema.' },
    { status: 501 }
  )
}
