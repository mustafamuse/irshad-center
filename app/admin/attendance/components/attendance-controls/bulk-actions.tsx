'use client'

import { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import type { AttendanceStatus } from '../../_types'

interface BulkActionsProps {
  showMoreActions: boolean
  setShowMoreActions: (show: boolean) => void
  moreActionsRef: RefObject<HTMLDivElement>
  onMarkAll: (status: AttendanceStatus) => void
  onMarkRemaining: (status: AttendanceStatus) => void
  onClearAll: () => void
}

export function BulkActions({
  showMoreActions,
  setShowMoreActions,
  moreActionsRef,
  onMarkAll,
  onMarkRemaining,
  onClearAll,
}: BulkActionsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => onMarkAll('PRESENT')}
        className="flex-1 sm:flex-none"
      >
        <span className="hidden sm:inline">Mark All </span>Present
      </Button>
      <Button
        variant="outline"
        onClick={() => onMarkAll('ABSENT')}
        className="flex-1 sm:flex-none"
      >
        <span className="hidden sm:inline">Mark All </span>Absent
      </Button>
      <div className="relative" ref={moreActionsRef}>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={() => setShowMoreActions(!showMoreActions)}
        >
          More
        </Button>
        {showMoreActions && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md bg-card shadow-lg ring-1 ring-black/5">
            <div className="py-1">
              <button
                className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMarkRemaining('PRESENT')
                  setShowMoreActions(false)
                }}
              >
                Mark Remaining as Present
              </button>
              <button
                className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMarkRemaining('ABSENT')
                  setShowMoreActions(false)
                }}
              >
                Mark Remaining as Absent
              </button>
              <button
                className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onClearAll()
                  setShowMoreActions(false)
                }}
              >
                Clear All Marks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
