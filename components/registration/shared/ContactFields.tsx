import { Loader2 } from 'lucide-react'
import { Control, FieldValues, Path } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import {
  formatPhoneNumber,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'

interface ContactFieldsProps<T extends FieldValues> {
  control: Control<T>
  emailField: Path<T>
  phoneField: Path<T>
  emailLabel?: string
  phoneLabel?: string
  emailPlaceholder?: string
  phonePlaceholder?: string
  phoneHelperText?: string
  required?: boolean
  isCheckingEmail?: boolean
  onEmailBlur?: (email: string) => Promise<void>
  onPhoneChange?: (value: string) => void
}

export function ContactFields<T extends FieldValues>({
  control,
  emailField,
  phoneField,
  emailLabel = 'Email',
  phoneLabel = 'Phone Number',
  emailPlaceholder = 'Enter email address',
  phonePlaceholder = 'XXX-XXX-XXXX',
  phoneHelperText,
  required = true,
  isCheckingEmail = false,
  onEmailBlur,
  onPhoneChange,
}: ContactFieldsProps<T>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      <FormFieldWrapper
        control={control}
        name={emailField}
        label={emailLabel}
        required={required}
      >
        {(field, fieldState) => (
          <div className="relative">
            <Input
              type="email"
              placeholder={emailPlaceholder}
              autoComplete="email"
              {...field}
              onBlur={async (e) => {
                field.onBlur()
                if (onEmailBlur) {
                  await onEmailBlur(e.target.value)
                }
              }}
              aria-invalid={!!fieldState.error}
              className={getInputClassNames(
                !!fieldState.error,
                isCheckingEmail
              )}
            />
            {isCheckingEmail && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </FormFieldWrapper>

      <FormFieldWrapper
        control={control}
        name={phoneField}
        label={phoneLabel}
        required={required}
      >
        {(field, fieldState) => (
          <>
            <Input
              type="tel"
              placeholder={phonePlaceholder}
              {...field}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value)
                field.onChange(formatted)
                if (onPhoneChange) {
                  onPhoneChange(formatted)
                }
              }}
              aria-invalid={!!fieldState.error}
              className={getInputClassNames(!!fieldState.error)}
            />
            {phoneHelperText && (
              <p className="text-xs text-muted-foreground">{phoneHelperText}</p>
            )}
          </>
        )}
      </FormFieldWrapper>
    </div>
  )
}
