import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  // TODO: Migrate restore functionality to Person/ProgramProfile/Enrollment/BillingAssignment model
  // Legacy Student and Sibling models have been removed
  return NextResponse.json(
    {
      success: false,
      error: 'Migration needed - Legacy Student and Sibling models removed. Restore functionality needs to be updated for Person/ProgramProfile/Enrollment model.',
    },
    { status: 501 }
  )
}
