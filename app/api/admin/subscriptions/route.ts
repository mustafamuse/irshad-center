import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  return NextResponse.json({
    Student: [],
    summary: {
      total: 0,
      active: 0,
      inactive: 0,
    },
  })
}

export const dynamic = 'force-dynamic'
