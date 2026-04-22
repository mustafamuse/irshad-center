import { GradeLevel, GraduationStatus, PaymentFrequency } from '@prisma/client'
import { Control } from 'react-hook-form'
import { z } from 'zod'

import {
  emailSchema,
  nameSchema,
  phoneSchema,
  schoolNameSchema,
  SHOW_GRADE_SCHOOL,
} from '@/lib/registration/schemas/registration-field-schemas'
import { getAgeInYears } from '@/lib/registration/utils/date-of-birth'


export const MAHAD_GRADE_OPTIONS = [
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'SOPHOMORE', label: 'Sophomore' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SENIOR', label: 'Senior' },
] as const

export const mahadRegistrationSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: z
    .date()
    .refine((date) => {
      const age = getAgeInYears(date)
      return age >= 15 && age <= 100
    }, 'Student must be between 15 and 100 years old')
    .refine(
      (date) => date <= new Date(),
      'Date of birth cannot be in the future'
    ),
  gradeLevel: SHOW_GRADE_SCHOOL
    ? z.nativeEnum(GradeLevel, {
        required_error: 'Please select your grade level',
      })
    : z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: SHOW_GRADE_SCHOOL
    ? schoolNameSchema
    : schoolNameSchema.nullable().optional(),
  graduationStatus: z.nativeEnum(GraduationStatus, {
    required_error: 'Please select your graduation status',
  }),
  paymentFrequency: z.nativeEnum(PaymentFrequency, {
    required_error: 'Please select a payment frequency',
  }),
})

export type MahadRegistrationValues = z.infer<typeof mahadRegistrationSchema>

export interface MahadFormSectionProps {
  control: Control<MahadRegistrationValues>
}

export const MAHAD_DEFAULT_FORM_VALUES: Partial<MahadRegistrationValues> = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: undefined,
  gradeLevel: undefined,
  schoolName: undefined,
  graduationStatus: undefined,
  paymentFrequency: undefined,
}
