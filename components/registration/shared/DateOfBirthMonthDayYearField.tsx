'use client'

import { useEffect, useRef, useState } from 'react'

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
          hasError={!!fieldState.error}
          value={field.value as Date | undefined}
          onChange={field.onChange}
        />
      )}
    </FormFieldWrapper>
  )
}

function MonthDayYearInputs({
  hasError,
  value,
  onChange,
}: {
  hasError: boolean
  value: Date | undefined
  onChange: (next: Date | undefined) => void
}) {
  const [month, setMonth] = useState(() => parseDateParts(value).month)
  const [day, setDay] = useState(() => parseDateParts(value).day)
  const [year, setYear] = useState(() => parseDateParts(value).year)
  const skipSyncRef = useRef(false)

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
    const built = tryBuildDate(nextMonth.trim(), nextDay.trim(), nextYear.trim())
    skipSyncRef.current = true
    onChange(built)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Month</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="MM"
            maxLength={2}
            aria-label="Birth month"
            className={inputClass}
            value={month}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2)
              commit(v, day, year)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Day</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="DD"
            maxLength={2}
            aria-label="Birth day"
            className={inputClass}
            value={day}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2)
              commit(month, v, year)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Year</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="YYYY"
            maxLength={4}
            aria-label="Birth year"
            className={inputClass}
            value={year}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              commit(month, day, v)
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter your date of birth as month, day, and year. Example: March 5, 2005 →
        03 / 05 / 2005
      </p>
    </div>
  )
}
