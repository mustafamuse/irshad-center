import { NextResponse } from 'next/server'

/** Data Restore API - Needs migration. TODO: PR 2e. */
export async function POST() {
  return NextResponse.json({ error: 'Needs migration.' }, { status: 501 })
}
