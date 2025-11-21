import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'

// GET /api/admin/students/[id]/payments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify profile exists
    const profile = await getProgramProfileById(id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get payments for this profile
    const payments = await prisma.studentPayment.findMany({
      where: {
        programProfileId: id,
      },
      orderBy: {
        paidAt: 'desc',
      },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('[GET_PAYMENTS] Error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch payments',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
