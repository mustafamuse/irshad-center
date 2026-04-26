'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { Control, FieldValues, Path } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import {
  parseDateParts,
  tryBuildDate,
} from '@/lib/registration/utils/date-of-birth'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'

interface DateOfBirthMonthDayYearFieldProps<T extends FieldValues> {
  control: Control<T>
  fieldName: Path<T>
  label?: string
  required?: boolean
}

export function DateOfBirthMonthDayYearField<T extends FieldValues>({
  control,
  fieldName,
  label = 'Date of Birth',
  required = true,
}: DateOfBirthMonthDayYearFieldProps<T>) {
  return (
    <FormFieldWrapper
      control={control}
      name={fieldName}
      label={label}
      required={required}
    >
      {(field, fieldState) => (
        <MonthDayYearInputs
          groupLabel={label}
          required={required}
          hasError={!!fieldState.error}
          value={field.value as Date | undefined}
          onChange={field.onChange}
        />
      )}
    </FormFieldWrapper>
  )
}

function MonthDayYearInputs({
  groupLabel,
  required,
  hasError,
  value,
  onChange,
}: {
  groupLabel: string
  required: boolean
  hasError: boolean
  value: Date | undefined
  onChange: (next: Date | undefined) => void
}) {
  const [month, setMonth] = useState(() => parseDateParts(value).month)
  const [day, setDay] = useState(() => parseDateParts(value).day)
  const [year, setYear] = useState(() => parseDateParts(value).year)
  const skipSyncRef = useRef(false)
  const dayRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)

  const monthId = useId()
  const dayId = useId()
  const yearId = useId()
  const hintId = useId()

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    const p = parseDateParts(value)
    setMonth(p.month)
    setDay(p.day)
    setYear(p.year)
  }, [value])

  const inputClass = getInputClassNames(hasError)

  function commit(nextMonth: string, nextDay: string, nextYear: string) {
    setMonth(nextMonth)
    setDay(nextDay)
    setYear(nextYear)
    const built = tryBuildDate(
      nextMonth.trim(),
      nextDay.trim(),
      nextYear.trim()
    )
    skipSyncRef.current = true
    onChange(built)
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{groupLabel}</legend>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor={monthId}
            className="text-xs font-medium text-muted-foreground"
          >
            Month
          </label>
          <Input
            id={monthId}
            type="text"
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="MM"
            maxLength={2}
            aria-required={required}
            aria-invalid={hasError}
            aria-describedby={hintId}
            className={inputClass}
            value={month}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2)
              commit(v, day, year)
              if (v.length === 2) dayRef.current?.focus()
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={dayId}
            className="text-xs font-medium text-muted-foreground"
          >
            Day
          </label>
          <Input
            ref={dayRef}
            id={dayId}
            type="text"
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="DD"
            maxLength={2}
            aria-required={required}
            aria-invalid={hasError}
            aria-describedby={hintId}
            className={inputClass}
            value={day}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2)
              commit(month, v, year)
              if (v.length === 2) yearRef.current?.focus()
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={yearId}
            className="text-xs font-medium text-muted-foreground"
          >
            Year
          </label>
          <Input
            ref={yearRef}
            id={yearId}
            type="text"
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="YYYY"
            maxLength={4}
            aria-required={required}
            aria-invalid={hasError}
            aria-describedby={hintId}
            className={inputClass}
            value={year}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              commit(month, day, v)
            }}
          />
        </div>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        Enter your date of birth as month, day, and year. Example: March 5, 2005
        → 03 / 05 / 2005
      </p>
    </fieldset>
  )
}
