'use client'

import { useState, useRef } from 'react'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { KeyboardShortcuts } from './keyboard-shortcuts'
import { BulkActions } from './bulk-actions'
import { AttendanceStats } from './attendance-stats'
import type { AttendanceStatus } from '../../_types'

interface AttendanceControlsProps {
  date: Date
  onBack: () => void
  onSave: () => Promise<void>
  onMarkAll: (status: AttendanceStatus) => void
  onMarkRemaining: (status: AttendanceStatus) => void
  onClearAll: () => void
  isSaving: boolean
  stats: {
    present: number
    absent: number
    late: number
    excused: number
    total: number
    marked: number
  }
}

export function AttendanceControls({
  date,
  onBack,
  onSave,
  onMarkAll,
  onMarkRemaining,
  onClearAll,
  isSaving,
  stats,
}: AttendanceControlsProps) {
  const [showMoreActions, setShowMoreActions] = useState(false)
  const moreActionsRef = useRef<HTMLDivElement>(null)

  return (
    <div className="space-y-6">
      <div className="space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        {/* Header and Back Button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={onBack} className="w-fit">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Mark Attendance</h2>
            <p className="text-muted-foreground">{format(date, 'PPPP')}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <BulkActions
            showMoreActions={showMoreActions}
            setShowMoreActions={setShowMoreActions}
            moreActionsRef={moreActionsRef}
            onMarkAll={onMarkAll}
            onMarkRemaining={onMarkRemaining}
            onClearAll={onClearAll}
          />
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Attendance
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KeyboardShortcuts />
        <AttendanceStats stats={stats} />
      </div>
    </div>
  )
}
