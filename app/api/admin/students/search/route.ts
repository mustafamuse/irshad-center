import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json({
    students: [],
    total: 0,
    query: '',
  })
}

export const dynamic = 'force-dynamic'
