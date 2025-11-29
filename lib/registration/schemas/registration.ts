import { GradeLevel, Gender } from '@prisma/client'
import { Control } from 'react-hook-form'
import { z } from 'zod'

// ============================================================================
// SHARED CONSTANTS & LABELS
// ============================================================================

export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  // College grades (Mahad)
  FRESHMAN: 'Freshman',
  SOPHOMORE: 'Sophomore',
  JUNIOR: 'Junior',
  SENIOR: 'Senior',

  // K-12 grades (Dugsi)
  KINDERGARTEN: 'Kindergarten',
  GRADE_1: '1st Grade',
  GRADE_2: '2nd Grade',
  GRADE_3: '3rd Grade',
  GRADE_4: '4th Grade',
  GRADE_5: '5th Grade',
  GRADE_6: '6th Grade',
  GRADE_7: '7th Grade',
  GRADE_8: '8th Grade',
  GRADE_9: '9th Grade',
  GRADE_10: '10th Grade',
  GRADE_11: '11th Grade',
  GRADE_12: '12th Grade',
}

// ============================================================================
// MAHAD (COLLEGE) OPTIONS
// ============================================================================

// Grade options for Mahad students (college year tracking)
export const MAHAD_GRADE_OPTIONS = [
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'SOPHOMORE', label: 'Sophomore' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SENIOR', label: 'Senior' },
] as const

// ============================================================================
// DUGSI (K-12) OPTIONS
// ============================================================================

// Grade options for Dugsi students (K-12)
export const DUGSI_GRADE_OPTIONS = [
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  { value: 'GRADE_1', label: '1st Grade' },
  { value: 'GRADE_2', label: '2nd Grade' },
  { value: 'GRADE_3', label: '3rd Grade' },
  { value: 'GRADE_4', label: '4th Grade' },
  { value: 'GRADE_5', label: '5th Grade' },
  { value: 'GRADE_6', label: '6th Grade' },
  { value: 'GRADE_7', label: '7th Grade' },
  { value: 'GRADE_8', label: '8th Grade' },
  { value: 'GRADE_9', label: '9th Grade' },
  { value: 'GRADE_10', label: '10th Grade' },
  { value: 'GRADE_11', label: '11th Grade' },
  { value: 'GRADE_12', label: '12th Grade' },
] as const

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Boy' },
  { value: 'FEMALE', label: 'Girl' },
] as const

// ============================================================================
// REUSABLE FIELD SCHEMAS
// ============================================================================

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s-]+$/, 'Name can only contain letters, spaces, and hyphens')

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(100, 'Email must be less than 100 characters')

export const phoneSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{4}$/, 'Enter a valid phone number (XXX-XXX-XXXX)')

const schoolNameSchema = z
  .string()
  .min(2, 'School name must be at least 2 characters')
  .max(100, 'School name must be less than 100 characters')
  .regex(
    /^[a-zA-Z0-9\s-.']+$/,
    'School name can only contain letters, numbers, spaces, hyphens, periods, and apostrophes'
  )

// ============================================================================
// MAHAD (SELF-REGISTRATION) SCHEMA
// ============================================================================

export const mahadRegistrationSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: z
    .date()
    .refine((date) => {
      const age = Math.floor((Date.now() - date.getTime()) / 31536000000)
      return age >= 15 && age <= 100
    }, 'Student must be between 15 and 100 years old')
    .refine(
      (date) => date <= new Date(),
      'Date of birth cannot be in the future'
    ),
  // Grade level is optional for tracking college year
  gradeLevel: z
    .nativeEnum(GradeLevel, {
      required_error: 'Please select your grade level',
    })
    .nullable(),
  schoolName: schoolNameSchema,
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
  gradeLevel: null,
  schoolName: '',
}

// ============================================================================
// DUGSI (PARENT-LED REGISTRATION) SCHEMA
// ============================================================================

export const childInfoSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  gender: z.nativeEnum(Gender, {
    required_error: 'Please select gender',
  }),
  dateOfBirth: z
    .date()
    .refine((date) => {
      const age = Math.floor((Date.now() - date.getTime()) / 31536000000)
      return age >= 5 && age <= 18
    }, 'Child must be between 5 and 18 years old')
    .refine(
      (date) => date <= new Date(),
      'Date of birth cannot be in the future'
    ),
  // Grade level is required for K-12 students
  gradeLevel: z.nativeEnum(GradeLevel, {
    required_error: 'Please select grade level',
  }),
  schoolName: schoolNameSchema,
  healthInfo: z
    .string()
    .min(1, 'Please provide health information or type "None"')
    .max(500, 'Please keep health information under 500 characters'),
})

export const dugsiRegistrationSchema = z
  .object({
    // Parent/Guardian 1 (Primary - Required)
    parent1FirstName: nameSchema,
    parent1LastName: nameSchema,
    parent1Email: emailSchema,
    parent1Phone: phoneSchema,

    // Single Parent Indicator
    isSingleParent: z.boolean().default(false),

    // Parent/Guardian 2 (Secondary - Conditional)
    parent2FirstName: nameSchema.optional().or(z.literal('')),
    parent2LastName: nameSchema.optional().or(z.literal('')),
    parent2Email: emailSchema.optional().or(z.literal('')),
    parent2Phone: phoneSchema.optional().or(z.literal('')),

    // Primary Payer Selection (which parent is responsible for payments)
    primaryPayer: z.enum(['parent1', 'parent2']).default('parent1'),

    // Children (Array)
    children: z
      .array(childInfoSchema)
      .min(1, 'You must add at least one child'),
  })
  .refine(
    (data) => {
      // If not single parent, require all parent 2 fields
      if (!data.isSingleParent) {
        return (
          data.parent2FirstName &&
          data.parent2LastName &&
          data.parent2Email &&
          data.parent2Phone
        )
      }
      return true
    },
    {
      message:
        'Parent/Guardian 2 information is required for two-parent households',
      path: ['parent2FirstName'],
    }
  )

export type ChildInfo = z.infer<typeof childInfoSchema>
export type DugsiRegistrationValues = z.infer<typeof dugsiRegistrationSchema>

export interface DugsiFormSectionProps {
  control: Control<DugsiRegistrationValues>
}

export const DEFAULT_CHILD_VALUES: ChildInfo = {
  firstName: '',
  lastName: '',
  gender: undefined as unknown as Gender,
  dateOfBirth: null as unknown as Date,
  gradeLevel: undefined as unknown as GradeLevel,
  schoolName: '',
  healthInfo: '',
}

export const DUGSI_DEFAULT_FORM_VALUES: Partial<DugsiRegistrationValues> = {
  parent1FirstName: '',
  parent1LastName: '',
  parent1Email: '',
  parent1Phone: '',
  isSingleParent: false,
  parent2FirstName: '',
  parent2LastName: '',
  parent2Email: '',
  parent2Phone: '',
  primaryPayer: 'parent1',
  children: [DEFAULT_CHILD_VALUES, DEFAULT_CHILD_VALUES],
}

// ============================================================================
// SHARED INTERFACES
// ============================================================================

export interface SearchResult {
  id: string
  name: string
  lastName: string
}
