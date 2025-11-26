import { NextResponse } from 'next/server'

/** Cleanup Abandoned Enrollments Cron - Needs migration. TODO: PR 2e. */
export async function GET() {
  return NextResponse.json({ error: 'Needs migration.' }, { status: 501 })
}
