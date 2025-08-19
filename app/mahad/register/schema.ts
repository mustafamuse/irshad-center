import { EducationLevel, GradeLevel } from '@prisma/client'
import { Control } from 'react-hook-form'
import { z } from 'zod'

// Form Schema
export const studentFormSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s-]+$/,
      'First name can only contain letters, spaces, and hyphens'
    ),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s-]+$/,
      'Last name can only contain letters, spaces, and hyphens'
    ),
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(100, 'Email must be less than 100 characters'),
  phone: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, 'Enter a valid phone number (XXX-XXX-XXXX)'),
  dateOfBirth: z
    .date()
    .min(new Date('1990-01-01'), 'Date of birth must be after 1990')
    .max(new Date(), 'Date of birth cannot be in the future'),
  educationLevel: z.nativeEnum(EducationLevel, {
    required_error: 'Please select your education level',
  }),
  gradeLevel: z
    .nativeEnum(GradeLevel, {
      required_error: 'Please select your grade level',
    })
    .nullable(),
  schoolName: z
    .string()
    .min(2, 'School name must be at least 2 characters')
    .max(100, 'School name must be less than 100 characters')
    .regex(
      /^[a-zA-Z0-9\s-.']+$/,
      'School name can only contain letters, numbers, spaces, hyphens, periods, and apostrophes'
    ),
})

// Types
export type StudentFormValues = z.infer<typeof studentFormSchema>

export interface FormSectionProps {
  control: Control<StudentFormValues>
}
