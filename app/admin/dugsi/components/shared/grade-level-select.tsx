'use client'

import { Control, FieldPath, FieldValues } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const GRADE_LEVELS = [
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  { value: 'GRADE_1', label: 'Grade 1' },
  { value: 'GRADE_2', label: 'Grade 2' },
  { value: 'GRADE_3', label: 'Grade 3' },
  { value: 'GRADE_4', label: 'Grade 4' },
  { value: 'GRADE_5', label: 'Grade 5' },
  { value: 'GRADE_6', label: 'Grade 6' },
  { value: 'GRADE_7', label: 'Grade 7' },
  { value: 'GRADE_8', label: 'Grade 8' },
  { value: 'GRADE_9', label: 'Grade 9' },
  { value: 'GRADE_10', label: 'Grade 10' },
  { value: 'GRADE_11', label: 'Grade 11' },
  { value: 'GRADE_12', label: 'Grade 12' },
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'SOPHOMORE', label: 'Sophomore' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SENIOR', label: 'Senior' },
] as const

interface GradeLevelSelectProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  disabled?: boolean
}

export function GradeLevelSelect<T extends FieldValues>({
  control,
  name,
  disabled,
}: GradeLevelSelectProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Grade Level (Optional)</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select grade level" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {GRADE_LEVELS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
