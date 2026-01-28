'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import type { SessionHistoryItem } from '@/lib/mappers/teacher-student-mapper'

import { loadMoreStudentHistory } from '../actions'

const statusColors: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  EXCUSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
}

interface Props {
  initialData: SessionHistoryItem[]
  profileId: string
  initialHasMore: boolean
}

export function SessionHistoryList({
  initialData,
  profileId,
  initialHasMore,
}: Props) {
  const [records, setRecords] = useState(initialData)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreStudentHistory(profileId, records.length)
      if (!result.success || !result.data) return
      const { data, hasMore: more } = result.data
      setRecords((prev) => [...prev, ...data])
      setHasMore(more)
    })
  }

  if (records.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No session history
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((r, i) => (
        <div
          key={`${r.sessionId}-${i}`}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {r.surahName && (
              <p className="text-xs text-muted-foreground">
                {r.surahName}
                {r.ayatFrom != null && ` ${r.ayatFrom}`}
                {r.ayatTo != null && `-${r.ayatTo}`}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[r.status] ?? ''}`}
          >
            {r.status}
          </span>
        </div>
      ))}
      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLoadMore}
          disabled={isPending}
        >
          {isPending ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
