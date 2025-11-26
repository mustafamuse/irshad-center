import { NextResponse } from 'next/server'

/** Students List API - Needs migration. TODO: PR 2e. */
export async function GET() {
  return NextResponse.json({ error: 'Needs migration.' }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({ error: 'Needs migration.' }, { status: 501 })
}
