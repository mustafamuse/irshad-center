'use client'

import { ReactNode } from 'react'

import {
  FieldPath,
  FieldValues,
  Control,
  ControllerFieldState,
  FieldMethod,
} from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { cn } from '@/lib/utils'

interface FormFieldWrapperProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>
  name: TName
  label: string
  required?: boolean
  children: (
    field: FieldMethod<TFieldValues>,
    fieldState: ControllerFieldState
  ) => ReactNode
  className?: string
}

export function FormFieldWrapper<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  required = false,
  children,
  className,
}: FormFieldWrapperProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('space-y-2.5', className)}>
          <FormLabel className="text-base font-medium">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </FormLabel>
          <FormControl>{children(field, fieldState)}</FormControl>
          <FormMessage className="text-sm" />
        </FormItem>
      )}
    />
  )
}
