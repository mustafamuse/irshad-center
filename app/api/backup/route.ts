import { NextResponse } from 'next/server'

/** Backup API - Needs migration. TODO: PR 2e. */
export async function GET() {
  return NextResponse.json(
    { error: 'Backup needs migration.' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
