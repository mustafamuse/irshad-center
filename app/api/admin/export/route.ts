import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/admin/export')

export async function GET() {
  try {
    // TODO: Migrate to ProgramProfile model - Student model removed
    const batches = await prisma.batch.findMany()

    // Create a seed data object with essential data only
    const seedData = {
      batches: batches.map((batch) => ({
        name: batch.name,
        startDate: batch.startDate?.toISOString() || null,
        endDate: batch.endDate?.toISOString() || null,
      })),
      Student: [],
      siblingGroups: [],
    }

    // Set headers for file download
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set(
      'Content-Disposition',
      `attachment; filename=seed-data-${new Date().toISOString().split('T')[0]}.json`
    )

    return new NextResponse(JSON.stringify(seedData, null, 2), {
      headers,
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to export data'
    )
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
