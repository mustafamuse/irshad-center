import { NextResponse } from 'next/server'

import { backupData } from '@/lib/actions/backup-data'
import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/backup')

export async function GET() {
  try {
    const result = await backupData()

    if (!result.success) {
      return NextResponse.json(result, { status: 501 })
    }

    return NextResponse.json({
      ...result,
      viewUrl: `/backups/${result.fileName}`,
    })
  } catch (error: unknown) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Backup failed'
    )
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Backup failed',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
