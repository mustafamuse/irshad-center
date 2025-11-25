import { NextRequest, NextResponse } from 'next/server'

import fs from 'fs'
import path from 'path'

import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/backups/[filename]')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const backupDir = path.join(process.cwd(), 'backups')
    const filePath = path.join(backupDir, filename)

    // Security check - ensure file is in backups directory
    if (!filePath.startsWith(backupDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Check if this is a download request
    const isDownload = request.nextUrl.searchParams.get('download') === 'true'

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': isDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error serving backup file'
    )
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
