import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { createAPILogger, logError } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const logger = createAPILogger('/api/health')

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logError(logger, error, 'Health check: database unreachable')

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'down', error: errorMessage },
        },
      },
      { status: 503 }
    )
  }
}
