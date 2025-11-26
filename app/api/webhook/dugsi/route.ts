import { NextResponse } from 'next/server'

/**
 * Dugsi Webhook Handler
 *
 * IMPORTANT: This webhook needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */
export async function POST() {
  console.error('[DUGSI_WEBHOOK] Webhook disabled during schema migration')
  return NextResponse.json(
    { error: 'Dugsi webhook needs migration to new schema.' },
    { status: 501 }
  )
}
