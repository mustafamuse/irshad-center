'use client'

import { memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Student } from '../../_types'
import { StatusBadge } from './status-badge'

interface StudentRowProps {
  student: Student
  index: number
  isSelected: boolean
  onSelect: (index: number) => void
  onAttendanceChange: (studentId: string, status: string) => void
  currentStatus: string
}

export const StudentRow = memo(function StudentRow({
  student,
  index,
  isSelected,
  onSelect,
  onAttendanceChange,
  currentStatus,
}: StudentRowProps) {
  // Memoize click handlers to prevent unnecessary re-renders
  const handleRowClick = useCallback(() => {
    onSelect(index)
  }, [onSelect, index])

  const handleStatusChange = useCallback(
    (status: string) => {
      onAttendanceChange(student.id, status)
    },
    [onAttendanceChange, student.id]
  )

  // Memoize status buttons to prevent unnecessary re-renders
  const renderStatusButton = useCallback(
    (status: string) => (
      <Button
        key={status}
        size="sm"
        variant={currentStatus === status ? 'default' : 'outline'}
        onClick={(e) => {
          e.stopPropagation()
          handleStatusChange(status)
        }}
        className="w-full sm:w-10"
      >
        {status.charAt(0).toUpperCase()}
      </Button>
    ),
    [currentStatus, handleStatusChange]
  )

  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between rounded-lg border p-4 sm:flex-row sm:items-center',
        isSelected ? 'bg-muted' : '',
        'transition-colors duration-200 hover:bg-muted/50'
      )}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick()
        }
      }}
    >
      <div className="mb-4 flex-1 sm:mb-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            #{String(index + 1).padStart(2, '0')}
          </span>
          <p className="font-medium">{student.name}</p>
          {currentStatus && <StatusBadge status={currentStatus} />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{student.email}</p>
      </div>
      <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
        {['present', 'absent', 'late', 'excused'].map(renderStatusButton)}
      </div>
    </div>
  )
})

StudentRow.displayName = 'StudentRow'
