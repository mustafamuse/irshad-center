import { NextResponse } from 'next/server'

/**
 * Manual Payment API Route
 * NOTE: Needs migration to new schema. TODO: PR 2e.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Students API needs migration to new schema.' },
    { status: 501 }
  )
}
