'use client'

import { Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LessonCompletionBadgeProps {
  completed: boolean
  className?: string
}

export function LessonCompletionBadge({
  completed,
  className,
}: LessonCompletionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        completed
          ? 'border-green-300 text-green-700'
          : 'border-gray-300 text-gray-500',
        className
      )}
    >
      {completed ? (
        <Check className="mr-1 h-3 w-3" />
      ) : (
        <X className="mr-1 h-3 w-3" />
      )}
      {completed ? 'Lesson Complete' : 'No Lesson'}
    </Badge>
  )
}
