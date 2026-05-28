import { cookies } from 'next/headers'

import { verifyAuthToken } from '@/lib/auth/admin-auth'
import { getDugsiRosterByTeacher } from '@/lib/db/queries/roster-export'

const FORMULA_CHARS = /^[=+\-@\t\r]/

function csvCell(value: string | null | undefined): string {
  let s = value ?? ''
  if (FORMULA_CHARS.test(s)) s = "'" + s
  if (
    s.includes(',') ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token || !verifyAuthToken(token)) {
    return new Response('Unauthorized', { status: 401 })
  }

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

  const csv = [header, ...lines].join('\n')
  const filename = `dugsi-rosters-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
