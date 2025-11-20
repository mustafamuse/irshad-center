import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

// GET /api/admin/students/[id]/payments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json([])
}

export const dynamic = 'force-dynamic'
