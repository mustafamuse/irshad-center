import { Control, FieldValues, Path } from 'react-hook-form'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'

interface EducationOption {
  value: string
  label: string
}

interface EducationFieldsProps<T extends FieldValues> {
  control: Control<T>
  educationLevelField: Path<T>
  gradeLevelField: Path<T>
  educationOptions: readonly EducationOption[]
  gradeOptions: readonly EducationOption[]
  educationLabel?: string
  gradeLabel?: string
  educationPlaceholder?: string
  gradePlaceholder?: string
  required?: boolean
  onEducationChange?: (value: string) => void
  onGradeChange?: (value: string) => void
}

export function EducationFields<T extends FieldValues>({
  control,
  educationLevelField,
  gradeLevelField,
  educationOptions,
  gradeOptions,
  educationLabel = 'Education Level',
  gradeLabel = 'Grade Level',
  educationPlaceholder = 'Select education level',
  gradePlaceholder = 'Select grade level',
  required = true,
  onEducationChange,
  onGradeChange,
}: EducationFieldsProps<T>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      <FormFieldWrapper
        control={control}
        name={educationLevelField}
        label={educationLabel}
        required={required}
      >
        {(field, fieldState) => (
          <Select
            value={field.value || ''}
            onValueChange={(value) => {
              field.onChange(value)
              if (onEducationChange) {
                onEducationChange(value)
              }
            }}
          >
            <SelectTrigger
              aria-invalid={!!fieldState.error}
              className={getInputClassNames(!!fieldState.error)}
            >
              <SelectValue placeholder={educationPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {educationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormFieldWrapper>

      <FormFieldWrapper
        control={control}
        name={gradeLevelField}
        label={gradeLabel}
        required={required}
      >
        {(field, fieldState) => (
          <Select
            value={field.value || ''}
            onValueChange={(value) => {
              field.onChange(value)
              if (onGradeChange) {
                onGradeChange(value)
              }
            }}
          >
            <SelectTrigger
              aria-invalid={!!fieldState.error}
              className={getInputClassNames(!!fieldState.error)}
            >
              <SelectValue placeholder={gradePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {gradeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormFieldWrapper>
    </div>
  )
}
