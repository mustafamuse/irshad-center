'use client'

import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ClassCardProps {
  id: string
  subject: string
  teacher: string
  startTime: string
  endTime: string
}

export function ClassCard({
  id,
  subject,
  teacher,
  startTime,
  endTime,
}: ClassCardProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="space-y-1">
          <h3 className="font-medium">{subject}</h3>
          <p className="text-sm text-muted-foreground">{teacher}</p>
          <p className="text-sm sm:hidden">
            {startTime} - {endTime}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="hidden text-sm sm:block">
            {startTime} - {endTime}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto sm:ml-4"
            onClick={() => {
              // TODO: Navigate to attendance detail page
              console.log('Navigate to attendance for class:', id)
            }}
          >
            Take Attendance
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
