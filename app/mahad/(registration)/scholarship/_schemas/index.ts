import { z } from 'zod'

// Applicant Details Step Schema
export const applicantDetailsSchema = z
  .object({
    studentName: z.string().min(1, 'Please select your name'),
    className: z.string().min(1, 'Class is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    payer: z.enum(['self', 'relative'], {
      required_error: 'Please select who will be paying',
      invalid_type_error: 'Please select who will be paying',
    }),
    payerRelation: z.string().optional(),
    payerName: z.string().optional(),
    payerPhone: z.string().optional(),
    siblingCount: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.payer === 'relative') {
        return data.payerRelation && data.payerName && data.payerPhone
      }
      return true
    },
    {
      message: 'Please fill in all payer information',
      path: ['payer'],
    }
  )

// Financial Assessment Step Schema
export const HIGH_SCHOOL_YEARS = [
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
] as const
export const COLLEGE_YEARS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const

export const financialAssessmentSchema = z
  .object({
    educationStatus: z.enum(['highschool', 'college', 'not-studying'], {
      required_error: 'Please select your education status',
      invalid_type_error: 'Please select your education status',
    }),
    schoolName: z.string().optional(),
    schoolYear: z
      .union([z.enum(HIGH_SCHOOL_YEARS), z.string().length(0)])
      .optional(),
    collegeName: z.string().optional(),
    collegeYear: z
      .union([z.enum(COLLEGE_YEARS), z.string().length(0)])
      .optional(),
    qualifiesForFafsa: z.enum(['yes', 'no']).optional(),
    fafsaExplanation: z.string().optional(),
    householdSize: z
      .string({
        required_error: 'Please enter your household size',
        invalid_type_error: 'Please enter your household size',
      })
      .min(1, 'Please enter your household size')
      .transform((val) => {
        const num = parseInt(val)
        if (isNaN(num)) throw new Error('Please enter a valid number')
        return num
      })
      .pipe(z.number().min(1, 'Must be at least 1')),
    dependents: z
      .string({
        required_error: 'Please enter number of dependents',
        invalid_type_error: 'Please enter number of dependents',
      })
      .min(1, 'Please enter number of dependents')
      .transform((val) => {
        const num = parseInt(val)
        if (isNaN(num)) throw new Error('Please enter a valid number')
        return num
      })
      .pipe(z.number().min(0, 'Cannot be negative')),
    adultsInHousehold: z
      .string({
        required_error: 'Please enter number of adults',
        invalid_type_error: 'Please enter number of adults',
      })
      .min(1, 'Please enter number of adults')
      .transform((val) => {
        const num = parseInt(val)
        if (isNaN(num)) throw new Error('Please enter a valid number')
        return num
      })
      .pipe(z.number().min(1, 'Must have at least 1 adult')),
    livesWithBothParents: z.enum(['yes', 'no'], {
      required_error: 'Please indicate if you live with both parents',
      invalid_type_error: 'Please indicate if you live with both parents',
    }),
    livingExplanation: z.string().optional(),
    isEmployed: z.enum(['yes', 'no'], {
      required_error: 'Please indicate if you are employed',
      invalid_type_error: 'Please indicate if you are employed',
    }),
    monthlyIncome: z.number().nullable().default(null),
  })
  .refine(
    (data) => {
      if (data.educationStatus === 'highschool') {
        return (
          data.schoolName &&
          data.schoolYear &&
          HIGH_SCHOOL_YEARS.includes(
            data.schoolYear as (typeof HIGH_SCHOOL_YEARS)[number]
          )
        )
      }
      if (data.educationStatus === 'college') {
        return (
          data.collegeName &&
          data.collegeYear &&
          COLLEGE_YEARS.includes(
            data.collegeYear as (typeof COLLEGE_YEARS)[number]
          )
        )
      }
      return true
    },
    {
      message: 'Please complete all required education fields',
      path: ['educationStatus'],
    }
  )
  .refine(
    (data) => {
      if (data.educationStatus === 'college') {
        return data.qualifiesForFafsa !== undefined
      }
      return true
    },
    {
      message: 'Please indicate if you qualify for FAFSA',
      path: ['qualifiesForFafsa'],
    }
  )
  .refine(
    (data) => {
      if (data.livesWithBothParents === 'no') {
        return !!data.livingExplanation
      }
      return true
    },
    {
      message: 'Please explain your living situation',
      path: ['livingExplanation'],
    }
  )
  .refine(
    (data) => {
      if (data.isEmployed === 'yes') {
        return data.monthlyIncome !== null
      }
      return true
    },
    {
      message: 'Please enter your monthly income',
      path: ['monthlyIncome'],
    }
  )

// Scholarship Justification Step Schema
export const scholarshipJustificationSchema = z.object({
  needJustification: z
    .string()
    .min(50, 'Please provide a detailed explanation of your need'),
  goalSupport: z
    .string()
    .min(50, 'Please explain how this scholarship will support your goals'),
  commitment: z
    .string()
    .min(50, 'Please describe your commitment to the program'),
  additionalInfo: z.string().optional(),
})

export const acknowledgementSchema = z.object({
  termsAgreed: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
})

// Combined type for the entire form
// Input type (for form) - before transformation
export type ScholarshipApplicationData = z.input<
  typeof scholarshipApplicationSchema
>

// Output type (after validation/transformation) - for server-side
export type ScholarshipApplicationOutput = z.output<
  typeof scholarshipApplicationSchema
>

// Combined schema for server-side validation (simple object merge)
export const scholarshipApplicationSchema = z.object({
  // Applicant Details
  studentName: z.string().min(1, 'Please select your name'),
  className: z.string().min(1, 'Class is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  payer: z.enum(['self', 'relative']),
  payerRelation: z.string().optional(),
  payerName: z.string().optional(),
  payerPhone: z.string().optional(),
  siblingCount: z.number().optional(),
  // Financial Assessment
  educationStatus: z.enum(['highschool', 'college', 'not-studying']),
  schoolName: z.string().optional(),
  schoolYear: z
    .union([z.enum(HIGH_SCHOOL_YEARS), z.string().length(0)])
    .optional(),
  collegeName: z.string().optional(),
  collegeYear: z
    .union([z.enum(COLLEGE_YEARS), z.string().length(0)])
    .optional(),
  qualifiesForFafsa: z.enum(['yes', 'no']).optional(),
  fafsaExplanation: z.string().optional(),
  householdSize: z
    .string()
    .min(1)
    .transform((val) => {
      const num = parseInt(val)
      if (isNaN(num)) throw new Error('Please enter a valid number')
      return num
    })
    .pipe(z.number().min(1)),
  dependents: z
    .string()
    .min(1)
    .transform((val) => {
      const num = parseInt(val)
      if (isNaN(num)) throw new Error('Please enter a valid number')
      return num
    })
    .pipe(z.number().min(0)),
  adultsInHousehold: z
    .string()
    .min(1)
    .transform((val) => {
      const num = parseInt(val)
      if (isNaN(num)) throw new Error('Please enter a valid number')
      return num
    })
    .pipe(z.number().min(1)),
  livesWithBothParents: z.enum(['yes', 'no']),
  livingExplanation: z.string().optional(),
  isEmployed: z.enum(['yes', 'no']),
  monthlyIncome: z.number().nullable().optional(),
  // Scholarship Justification
  needJustification: z.string().min(50),
  goalSupport: z.string().min(50),
  commitment: z.string().min(50),
  additionalInfo: z.string().optional(),
  // Terms
  termsAgreed: z.boolean().refine((val) => val === true),
})
