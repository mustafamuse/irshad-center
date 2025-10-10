/**
 * Batch and Student Validation Schemas
 *
 * Zod validation schemas for batch and student operations.
 * These schemas provide runtime type validation and error messages.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'
import { z } from 'zod'

// Note: StudentStatus is a string in the database, not an enum
// Using string literals matching the actual database values
const StudentStatusEnum = z.enum([
  'registered', // Default - Initial state, not yet in classes
  'enrolled', // Actively attending classes
  'on_leave', // Temporary approved break
  'withdrawn', // No longer attending
])

// ============================================================================
// BATCH VALIDATION SCHEMAS
// ============================================================================

export const CreateBatchSchema = z.object({
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim(),
  startDate: z.date().optional(),
})

export const UpdateBatchSchema = z.object({
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

export const BatchAssignmentSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  studentIds: z
    .array(z.string().uuid('Invalid student ID'))
    .min(1, 'At least one student must be selected')
    .max(100, 'Cannot assign more than 100 students at once'),
})

export const BatchTransferSchema = z.object({
  fromBatchId: z.string().uuid('Invalid source batch ID'),
  toBatchId: z.string().uuid('Invalid destination batch ID'),
  studentIds: z
    .array(z.string().uuid('Invalid student ID'))
    .min(1, 'At least one student must be selected')
    .max(100, 'Cannot transfer more than 100 students at once'),
})

// ============================================================================
// STUDENT VALIDATION SCHEMAS
// ============================================================================

export const CreateStudentSchema = z.object({
  name: z
    .string()
    .min(1, 'Student name is required')
    .max(100, 'Student name must be less than 100 characters')
    .trim(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^[+]?[\d\s\-()]+$/.test(val),
      'Invalid phone number format'
    ),
  dateOfBirth: z
    .date()
    .max(new Date(), 'Date of birth cannot be in the future')
    .optional(),
  educationLevel: z.nativeEnum(EducationLevel).optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z
    .string()
    .max(200, 'School name must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  monthlyRate: z.number().min(0, 'Monthly rate cannot be negative').optional(),
  customRate: z.boolean().optional(),
  batchId: z.string().uuid('Invalid batch ID').optional(),
})

export const UpdateStudentSchema = CreateStudentSchema.partial()

// ============================================================================
// FILTER VALIDATION SCHEMAS
// ============================================================================

export const StudentFiltersSchema = z.object({
  search: z
    .object({
      query: z.string().optional(),
      fields: z.array(z.enum(['name', 'email', 'phone'])).optional(),
    })
    .optional(),
  batch: z
    .object({
      selected: z.array(z.string().uuid()).optional(),
      includeUnassigned: z.boolean().optional(),
    })
    .optional(),
  status: z
    .object({
      selected: z.array(StudentStatusEnum).optional(),
    })
    .optional(),
  educationLevel: z
    .object({
      selected: z.array(z.nativeEnum(EducationLevel)).optional(),
    })
    .optional(),
  gradeLevel: z
    .object({
      selected: z.array(z.nativeEnum(GradeLevel)).optional(),
    })
    .optional(),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
      field: z.enum(['createdAt', 'updatedAt', 'dateOfBirth']).optional(),
    })
    .optional(),
})

export const BatchFiltersSchema = z.object({
  search: z.string().optional(),
  hasStudents: z.boolean().optional(),
  dateRange: z
    .object({
      from: z.date(),
      to: z.date(),
    })
    .optional(),
})

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  pageSize: z
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20),
})

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const SearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query must be less than 100 characters')
    .trim(),
  filters: StudentFiltersSchema.optional(),
  pagination: PaginationSchema.optional(),
})

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const ExportStudentsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json'], {
    errorMap: () => ({ message: 'Format must be csv, xlsx, or json' }),
  }),
  batchIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  includeHeaders: z.boolean().default(true),
  fields: z
    .array(
      z.enum([
        'name',
        'email',
        'phone',
        'batch',
        'status',
        'educationLevel',
        'gradeLevel',
        'dateOfBirth',
        'createdAt',
        'updatedAt',
      ])
    )
    .optional(),
})

// ============================================================================
// DUPLICATE DETECTION SCHEMAS
// ============================================================================

export const DuplicateDetectionSchema = z.object({
  field: z.enum(['email', 'phone', 'name']),
  includeInactive: z.boolean().default(false),
  minimumMatches: z.number().int().min(2).default(2),
})

export const ResolveDuplicatesSchema = z.object({
  duplicateGroups: z.array(
    z.object({
      keepId: z.string().uuid('Invalid student ID'),
      deleteIds: z.array(z.string().uuid('Invalid student ID')),
    })
  ),
  mergeData: z.boolean().default(false),
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type CreateBatchInput = z.infer<typeof CreateBatchSchema>
export type UpdateBatchInput = z.infer<typeof UpdateBatchSchema>
export type BatchAssignmentInput = z.infer<typeof BatchAssignmentSchema>
export type BatchTransferInput = z.infer<typeof BatchTransferSchema>
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>
export type StudentFiltersInput = z.infer<typeof StudentFiltersSchema>
export type BatchFiltersInput = z.infer<typeof BatchFiltersSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>
export type SearchInput = z.infer<typeof SearchSchema>
export type ExportStudentsInput = z.infer<typeof ExportStudentsSchema>
export type DuplicateDetectionInput = z.infer<typeof DuplicateDetectionSchema>
export type ResolveDuplicatesInput = z.infer<typeof ResolveDuplicatesSchema>
