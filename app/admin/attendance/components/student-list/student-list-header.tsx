'use client'

import { memo, useMemo } from 'react'
import { CardHeader, CardTitle } from '@/components/ui/card'

interface StudentListHeaderProps {
  totalCount: number
  markedCount: number
}

export const StudentListHeader = memo(function StudentListHeader({
  totalCount,
  markedCount,
}: StudentListHeaderProps) {
  // Memoize progress calculation
  const progress = useMemo(
    () => (totalCount > 0 ? (markedCount / totalCount) * 100 : 0),
    [totalCount, markedCount]
  )

  return (
    <CardHeader className="space-y-2">
      <div className="flex items-center justify-between">
        <CardTitle>Students ({totalCount})</CardTitle>
        <p className="text-sm text-muted-foreground">
          {markedCount} of {totalCount} marked
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </CardHeader>
  )
})
