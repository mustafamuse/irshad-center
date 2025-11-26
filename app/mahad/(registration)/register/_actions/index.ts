'use server'

/**
 * Mahad Registration Server Actions
 *
 * IMPORTANT: This registration flow needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { z } from 'zod'

import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import {
  createStubbedAction,
  createStubbedQuery,
} from '@/lib/utils/stub-helpers'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Keep custom ActionResult for field-level validation errors
// (The generic ActionResult doesn't support field-specific errors)
type MahadActionResult<T = void> = T extends void
  ? {
      success: boolean
      data?: never
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
    }
  :
      | {
          success: true
          data: T
        }
      | {
          success: false
          error: string
          field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
        }

type StudentSearchResult = { id: string; name: string; lastName: string }

// ============================================================================
// REGISTRATION ACTIONS (Stubbed - needs migration)
// ============================================================================

/**
 * Register a new Mahad student with optional siblings
 */
export const registerStudent = createStubbedAction<
  [
    {
      studentData: z.infer<typeof mahadRegistrationSchema>
      siblingIds: string[] | null
    },
  ],
  { id: string; name: string }
>({
  feature: 'mahad_registration',
  reason: 'schema_migration',
  userMessage:
    'Mahad registration is temporarily unavailable. Please try again later.',
})

// ============================================================================
// UTILITY ACTIONS (Stubbed - needs migration)
// ============================================================================

/**
 * Check if email already exists
 */
export const checkEmailExists = createStubbedQuery<[string], boolean>(
  { feature: 'mahad_email_check', reason: 'schema_migration' },
  false
)

/**
 * Search students by name for sibling matching
 */
export const searchStudents = createStubbedQuery<
  [string, string],
  StudentSearchResult[]
>({ feature: 'mahad_student_search', reason: 'schema_migration' }, [])

/**
 * Add sibling relationship
 */
export const addSibling = createStubbedAction<[string, string]>({
  feature: 'mahad_add_sibling',
  reason: 'schema_migration',
  userMessage: 'Sibling management is temporarily unavailable.',
})

/**
 * Remove sibling relationship
 */
export const removeSibling = createStubbedAction<[string, string]>({
  feature: 'mahad_remove_sibling',
  reason: 'schema_migration',
  userMessage: 'Sibling management is temporarily unavailable.',
})

// Export the type for consumers that need field-level errors
export type { MahadActionResult }
