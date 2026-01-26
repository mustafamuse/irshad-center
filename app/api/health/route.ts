import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'up', latency: `${dbLatency}ms` },
      },
    })
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'down' },
        },
      },
      { status: 503 }
    )
  }
}
