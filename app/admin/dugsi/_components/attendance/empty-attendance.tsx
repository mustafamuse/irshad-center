'use client'

import { Calendar, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EmptyAttendanceProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyAttendance({
  title = 'No attendance session',
  description = 'Create a session to start marking attendance',
  action,
}: EmptyAttendanceProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="mb-4 rounded-full bg-muted p-3">
        <Calendar className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mb-2 font-medium">{title}</p>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  )
}
