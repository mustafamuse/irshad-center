import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

// POST /api/admin/students/[id]/manual-payment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}
