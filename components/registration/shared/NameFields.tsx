import { Control, FieldValues, Path } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'
import { capitalizeName } from '@/lib/utils'

interface NameFieldsProps<T extends FieldValues> {
  control: Control<T>
  firstNameField: Path<T>
  lastNameField: Path<T>
  firstNameLabel?: string
  lastNameLabel?: string
  firstNamePlaceholder?: string
  lastNamePlaceholder?: string
  required?: boolean
}

export function NameFields<T extends FieldValues>({
  control,
  firstNameField,
  lastNameField,
  firstNameLabel = 'First Name',
  lastNameLabel = 'Last Name',
  firstNamePlaceholder = 'Enter first name',
  lastNamePlaceholder = 'Enter last name',
  required = true,
}: NameFieldsProps<T>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      <FormFieldWrapper
        control={control}
        name={firstNameField}
        label={firstNameLabel}
        required={required}
      >
        {(field, fieldState) => (
          <Input
            {...field}
            placeholder={firstNamePlaceholder}
            aria-invalid={!!fieldState.error}
            className={getInputClassNames(!!fieldState.error)}
            onBlur={(e) => {
              const capitalized = capitalizeName(e.target.value)
              field.onChange(capitalized)
              field.onBlur()
            }}
          />
        )}
      </FormFieldWrapper>

      <FormFieldWrapper
        control={control}
        name={lastNameField}
        label={lastNameLabel}
        required={required}
      >
        {(field, fieldState) => (
          <Input
            {...field}
            placeholder={lastNamePlaceholder}
            aria-invalid={!!fieldState.error}
            className={getInputClassNames(!!fieldState.error)}
            onBlur={(e) => {
              const capitalized = capitalizeName(e.target.value)
              field.onChange(capitalized)
              field.onBlur()
            }}
          />
        )}
      </FormFieldWrapper>
    </div>
  )
}
