import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface SessionRecord {
  status: string
}

interface SessionCardProps {
  sessionId: string
  label: string
  records: SessionRecord[]
  isClosed: boolean
  href: string
}

export function SessionCard({
  label,
  records,
  isClosed,
  href,
}: SessionCardProps) {
  const totalRecords = records.length
  let presentCount = 0
  for (const r of records) {
    if (r.status === 'PRESENT' || r.status === 'LATE') presentCount++
  }

  const hasRecords = totalRecords > 0
  const statusText = hasRecords
    ? `${presentCount}/${totalRecords} present`
    : 'Not started'
  const statusColor = hasRecords ? 'text-green-600' : 'text-muted-foreground'

  return (
    <Card className="space-y-3 p-4">
      <span className="font-medium">{label}</span>
      <p className={`text-sm font-medium ${statusColor}`}>{statusText}</p>
      {!isClosed && (
        <Link href={href}>
          <Button className="w-full" variant="outline">
            Take Attendance
          </Button>
        </Link>
      )}
    </Card>
  )
}
