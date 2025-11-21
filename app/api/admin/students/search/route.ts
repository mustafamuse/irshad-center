import { NextResponse } from 'next/server'

export async function GET(_request: Request) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json({
    students: [],
    total: 0,
    query: '',
  })
}

export const dynamic = 'force-dynamic'
