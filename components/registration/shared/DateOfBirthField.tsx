'use client'

import type { ChangeEvent, ChangeEventHandler } from 'react'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Control, FieldValues, Path } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import { cn } from '@/lib/utils'

interface DateOfBirthFieldProps<T extends FieldValues> {
  control: Control<T>
  fieldName: Path<T>
  label?: string
  required?: boolean
  onValueChange?: (value: Date | null) => void
}

export function DateOfBirthField<T extends FieldValues>({
  control,
  fieldName,
  label = 'Date of Birth',
  required = true,
  onValueChange,
}: DateOfBirthFieldProps<T>) {
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
    <FormFieldWrapper
      control={control}
      name={fieldName}
      label={label}
      required={required}
    >
      {(field, fieldState) => (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                'w-full justify-start text-left font-normal',
                !field.value && 'text-muted-foreground',
                fieldState.error && 'border-destructive'
              )}
              variant="outline"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {field.value ? (
                format(field.value, 'PPP')
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
              selected={field.value || undefined}
              onSelect={(date) => {
                field.onChange(date || null)
                if (onValueChange) {
                  onValueChange(date || null)
                }
              }}
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
      )}
    </FormFieldWrapper>
  )
}
