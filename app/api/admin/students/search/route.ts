import { NextResponse } from 'next/server'

/** Students Search API - Needs migration. TODO: PR 2e. */
export async function GET() {
  return NextResponse.json({ error: 'Needs migration.' }, { status: 501 })
}
