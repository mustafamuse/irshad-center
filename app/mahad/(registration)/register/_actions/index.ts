'use server'

/**
 * Mahad Registration Server Actions
 *
 * IMPORTANT: This registration flow needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { z } from 'zod'

import { logger } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ActionResult<T = void> = T extends void
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

// ============================================================================
// REGISTRATION ACTIONS (Stubbed - needs migration)
// ============================================================================

/**
 * Register a new Mahad student with optional siblings
 */
export async function registerStudent(_input: {
  studentData: z.infer<typeof mahadRegistrationSchema>
  siblingIds: string[] | null
}): Promise<ActionResult<{ id: string; name: string }>> {
  logger.warn(
    { feature: 'mahad_registration', reason: 'schema_migration' },
    'Registration disabled during schema migration'
  )
  return {
    success: false,
    error:
      'Mahad registration is temporarily unavailable. Please try again later.',
  }
}

// ============================================================================
// UTILITY ACTIONS (Stubbed - needs migration)
// ============================================================================

/**
 * Check if email already exists
 */
export async function checkEmailExists(_email: string): Promise<boolean> {
  logger.warn(
    { feature: 'mahad_email_check', reason: 'schema_migration' },
    'Email check disabled during schema migration'
  )
  return false
}

/**
 * Search students by name for sibling matching
 */
export async function searchStudents(
  _query: string,
  _lastName: string
): Promise<{ id: string; name: string; lastName: string }[]> {
  logger.warn(
    { feature: 'mahad_student_search', reason: 'schema_migration' },
    'Student search disabled during schema migration'
  )
  return []
}

/**
 * Add sibling relationship
 */
export async function addSibling(
  _studentId: string,
  _siblingId: string
): Promise<ActionResult> {
  logger.warn(
    { feature: 'mahad_add_sibling', reason: 'schema_migration' },
    'Add sibling disabled during schema migration'
  )
  return {
    success: false,
    error: 'Sibling management is temporarily unavailable.',
  }
}

/**
 * Remove sibling relationship
 */
export async function removeSibling(
  _studentId: string,
  _siblingId: string
): Promise<ActionResult> {
  logger.warn(
    { feature: 'mahad_remove_sibling', reason: 'schema_migration' },
    'Remove sibling disabled during schema migration'
  )
  return {
    success: false,
    error: 'Sibling management is temporarily unavailable.',
  }
}
