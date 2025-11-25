'use client'

import type { ChangeEvent, ChangeEventHandler } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const handleCalendarChange = (
    value: string | number,
    event: ChangeEventHandler<HTMLSelectElement>
  ) => {
    const newEvent = {
      target: {
        value: String(value),
      },
    } as ChangeEvent<HTMLSelectElement>
    event(newEvent)
  }

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
          <PopoverContent
            align="start"
            className="max-w-[400px] p-3"
            style={{
              width: 'var(--radix-popover-trigger-width)',
              maxWidth: '400px',
            }}
          >
            <Calendar
              captionLayout="dropdown"
              className="w-full"
              fromYear={1900}
              toYear={2100}
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => onChange(date || null)}
              components={{
                MonthCaption: (props) => <>{props.children}</>,
                DropdownNav: (props) => (
                  <div className="flex w-full items-center gap-2">
                    {props.children}
                  </div>
                ),
                Dropdown: (props) => (
                  <Select
                    onValueChange={(value) => {
                      if (props.onChange) {
                        handleCalendarChange(value, props.onChange)
                      }
                    }}
                    value={String(props.value)}
                  >
                    <SelectTrigger className="first:flex-1 last:shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {props.options?.map((option) => (
                        <SelectItem
                          disabled={option.disabled}
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              }}
              hideNavigation
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
