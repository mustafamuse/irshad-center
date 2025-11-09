import { z } from 'zod'

import {
  emailSchema,
  nameSchema,
  phoneSchema,
} from '@/lib/registration/schemas/registration'

// ============================================================================
// PARENT FORM SCHEMA
// ============================================================================

export const parentFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
})

export type ParentFormValues = z.infer<typeof parentFormSchema>

// ============================================================================
// CHILD FORM SCHEMA
// ============================================================================

export const childFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  gender: z.enum(['MALE', 'FEMALE'], {
    required_error: 'Gender is required',
  }),
  dateOfBirth: z.string().optional(),
  educationLevel: z.enum(
    ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'COLLEGE', 'POST_GRAD'],
    {
      required_error: 'Education level is required',
    }
  ),
  gradeLevel: z.enum(
    [
      'KINDERGARTEN',
      'GRADE_1',
      'GRADE_2',
      'GRADE_3',
      'GRADE_4',
      'GRADE_5',
      'GRADE_6',
      'GRADE_7',
      'GRADE_8',
      'GRADE_9',
      'GRADE_10',
      'GRADE_11',
      'GRADE_12',
      'FRESHMAN',
      'SOPHOMORE',
      'JUNIOR',
      'SENIOR',
    ],
    {
      required_error: 'Grade level is required',
    }
  ),
  schoolName: z.string().optional(),
  healthInfo: z.string().optional(),
})

export type ChildFormValues = z.infer<typeof childFormSchema>
