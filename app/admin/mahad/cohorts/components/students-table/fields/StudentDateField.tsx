import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface StudentDateFieldProps {
  id?: string
  label: string
  value: Date | null
  isEditing: boolean
  onChange: (value: Date | null) => void
  disabled?: boolean
}

export function StudentDateField({
  id,
  label,
  value,
  isEditing,
  onChange,
  disabled = false,
}: StudentDateFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>

      {isEditing ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !value && 'text-muted-foreground'
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? (
                format(new Date(value), 'PPP')
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => onChange(date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      ) : value ? (
        <div className="flex items-center gap-2 text-sm">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {format(new Date(value), 'PPP')}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not provided</p>
      )}
    </div>
  )
}
