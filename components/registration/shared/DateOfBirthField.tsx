import { CalendarDate } from '@internationalized/date'
import { CalendarIcon } from 'lucide-react'
import {
  Button as RACButton,
  DatePicker,
  Dialog as RACDialog,
  Group,
  Popover,
} from 'react-aria-components'
import { Control, FieldValues, Path } from 'react-hook-form'

import { Calendar } from '@/components/ui/calendar-rac'
import { DateInput } from '@/components/ui/datefield-rac'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'

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
  return (
    <FormFieldWrapper
      control={control}
      name={fieldName}
      label={label}
      required={required}
    >
      {(field, fieldState) => (
        <DatePicker
          value={
            field.value
              ? new CalendarDate(
                  field.value.getFullYear(),
                  field.value.getMonth() + 1,
                  field.value.getDate()
                )
              : null
          }
          onChange={(date) => {
            if (date) {
              const dateValue = new Date(date.year, date.month - 1, date.day)
              field.onChange(dateValue)
              if (onValueChange) {
                onValueChange(dateValue)
              }
            } else {
              field.onChange(null)
              if (onValueChange) {
                onValueChange(null)
              }
            }
          }}
          aria-label={label}
          className="flex flex-col gap-2"
        >
          <div className="flex">
            <Group className="w-full">
              <DateInput className={getInputClassNames(!!fieldState.error)} />
            </Group>
            <RACButton className="data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-focus-visible:ring-[3px] z-10 -me-px -ms-9 flex w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground">
              <CalendarIcon size={16} />
            </RACButton>
          </div>
          <Popover
            className="data-entering:animate-in data-exiting:animate-out outline-hidden z-50 rounded-lg border bg-background text-popover-foreground shadow-lg data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2"
            offset={4}
          >
            <RACDialog className="max-h-[inherit] overflow-auto p-2">
              <Calendar />
            </RACDialog>
          </Popover>
        </DatePicker>
      )}
    </FormFieldWrapper>
  )
}
