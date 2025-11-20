'use server'

/**
 * Dugsi Registration Server Actions
 *
 * Direct Server Actions for parent-led registration (K-12 children).
 * Includes payment link generation for capturing payment methods.
 *
 * Follows the same error handling pattern as app/admin/mahad/cohorts/actions.ts
 *
 * ⚠️ CRITICAL MIGRATION NEEDED:
 * This file uses the legacy Student and Sibling models which have been removed.
 * All registration functions need to be migrated to:
 * - Person model for identity
 * - ProgramProfile model for program enrollment
 * - Enrollment model for enrollment details
 * - SiblingRelationship model for sibling tracking
 */

import { revalidatePath } from 'next/cache'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'
import {
  capitalizeNames,
  formatFullName,
} from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'
import {
  constructDugsiPaymentUrl,
  generateFamilyId,
} from '@/lib/utils/dugsi-payment'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Action result type for consistent response structure
 */
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

// ============================================================================
// PRISMA ERROR HANDLING
// ============================================================================

/**
 * Prisma error code constants
 */
const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
} as const

/**
 * Check if error is a Prisma error
 */
function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

/**
 * Centralized error handler for all actions
 */
function handleActionError<T = void>(
  error: unknown,
  action: string,
  context?: { name?: string; handlers?: Record<string, string> }
): ActionResult<T> {
  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return {
      success: false,
      errors: error.flatten().fieldErrors,
    }
  }

  // Log error with context for debugging
  console.error(`[${action}] Error:`, error)

  // Handle Prisma-specific errors with custom messages
  if (isPrismaError(error) && context?.handlers?.[error.code]) {
    return {
      success: false,
      error: context.handlers[error.code],
    }
  }

  // Default generic error message
  return {
    success: false,
    error: error instanceof Error ? error.message : `Failed to ${action}`,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
// Note: Duplicate checking is now handled by database constraints
// See: prisma/migrations/20251011141141_add_unique_constraints_duplicates

// ============================================================================
// REGISTRATION ACTIONS
// ============================================================================

/**
 * Register multiple children for Dugsi (parent-led enrollment)
 * Now includes payment link generation for capturing payment methods.
 */
export async function registerDugsiChildren(
  input: z.infer<typeof dugsiRegistrationSchema>
): Promise<
  ActionResult<{
    children: Array<{ id: string; name: string }>
    count: number
    paymentUrl?: string
    familyId?: string
  }>
> {
  try {
    const validated = dugsiRegistrationSchema.parse(input)

    return await prisma.$transaction(async (tx) => {
      // 1. Generate family ID for tracking
      const familyId = generateFamilyId(validated.parent1LastName)

      // 2. Capitalize parent names
      const { firstName: parent1FirstName, lastName: parent1LastName } =
        capitalizeNames(validated.parent1FirstName, validated.parent1LastName)

      let parent2FirstName: string | null = null
      let parent2LastName: string | null = null
      if (
        !validated.isSingleParent &&
        validated.parent2FirstName &&
        validated.parent2LastName
      ) {
        const parent2Names = capitalizeNames(
          validated.parent2FirstName,
          validated.parent2LastName
        )
        parent2FirstName = parent2Names.firstName
        parent2LastName = parent2Names.lastName
      }

      // TODO: Migrate to Person/ProgramProfile/Enrollment/SiblingRelationship model - Student and Sibling models removed
      // This is a critical user-facing registration flow that needs immediate migration
      return {
        success: false,
        error: 'Registration temporarily unavailable - system migration in progress. Please contact support.',
      }
    })
  } catch (error) {
    return handleActionError(error, 'registerDugsiChildren', {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]:
          'A student with this information already exists',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid reference in registration data',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Required record not found',
      },
    })
  } finally {
    revalidatePath('/dugsi/register')
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Check if parent email already exists
 */
export async function checkParentEmailExists(email: string): Promise<boolean> {
  // TODO: Migrate to Person/ProgramProfile model - Student model removed
  try {
    // Stub: Return false to allow registration to proceed
    // In production, this should check Person.email or ProgramProfile.parentEmail
    return false
  } catch (error) {
    console.error('[checkParentEmailExists] Error:', error)
    // Return false on error to allow registration to proceed
    // The database constraint will catch duplicates anyway
    return false
  }
}
