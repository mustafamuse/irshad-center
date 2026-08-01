import { cookies } from 'next/headers'

import { verifyAuthToken } from '@/lib/auth/admin-auth'
import { getDugsiRosterByTeacher } from '@/lib/db/queries/roster-export'
import { createServiceLogger, logError } from '@/lib/logger'
import { csvCell } from '@/lib/utils/csv'

const logger = createServiceLogger('dugsi-roster-export')

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token || !verifyAuthToken(token)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const rows = await getDugsiRosterByTeacher()

    const header = 'Teacher,Payer Name,Payer Phone,Payer Email,Children,Shift'
    const lines = rows.map((r) =>
      [
        csvCell(r.teacherName),
        csvCell(r.payerName),
        csvCell(r.payerPhone),
        csvCell(r.payerEmail),
        csvCell(r.children.sort().join('; ')),
        csvCell(r.shift === 'MORNING' ? 'Morning' : 'Afternoon'),
      ].join(',')
    )

    const csv = '﻿' + [header, ...lines].join('\n')
    const filename = `dugsi-rosters-${new Date().toISOString().slice(0, 10)}.csv`

    const teacherCount = new Set(rows.map((r) => r.teacherName)).size
    logger.info(
      { teacherCount, rowCount: rows.length },
      'Dugsi roster export served'
    )

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logError(logger, error, 'Failed to generate Dugsi roster export')
    return new Response('Failed to generate export', { status: 500 })
  }
}
