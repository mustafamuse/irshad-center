'use server'

/**
 * Dugsi Registration Server Actions
 *
 * Direct Server Actions for parent-led registration (K-12 children).
 * Includes payment link generation for capturing payment methods.
 *
 * Follows the same error handling pattern as app/batches/actions.ts
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

      // 3. Create all children with family reference ID
      const createdChildren = []

      for (const child of validated.children) {
        const childFullName = formatFullName(child.firstName, child.lastName)

        // Create student record with parent contact info and family reference
        try {
          const newStudent = await tx.student.create({
            data: {
              name: childFullName,
              email: null, // Children don't have email
              phone: null, // Children don't have phone
              dateOfBirth: child.dateOfBirth,
              gender: child.gender,
              educationLevel: child.educationLevel,
              gradeLevel: child.gradeLevel,
              schoolName: child.schoolName,
              healthInfo: child.healthInfo,
              program: 'DUGSI_PROGRAM',

              // Family tracking
              familyReferenceId: familyId,

              // Parent 1 contact
              parentFirstName: parent1FirstName,
              parentLastName: parent1LastName,
              parentEmail: validated.parent1Email,
              parentPhone: validated.parent1Phone,

              // Parent 2 contact (if provided)
              parent2FirstName,
              parent2LastName,
              parent2Email: validated.parent2Email || null,
              parent2Phone: validated.parent2Phone || null,
            },
            select: { id: true, name: true },
          })

          createdChildren.push(newStudent)
        } catch (createError) {
          // Handle unique constraint violations from database
          const duplicateError = handlePrismaUniqueError(createError, {
            name: childFullName,
            email: validated.parent1Email,
            phone: validated.parent1Phone,
          })

          if (duplicateError) {
            // Return error immediately on first duplicate child
            return {
              success: false,
              error: `Child ${child.firstName}: ${duplicateError.message}`,
            }
          }

          // Re-throw if not a duplicate error
          throw createError
        }
      }

      // 4. Create sibling group if multiple children
      if (createdChildren.length > 1) {
        await tx.sibling.create({
          data: {
            Student: {
              connect: createdChildren.map((child) => ({ id: child.id })),
            },
          },
        })
      }

      // 5. Generate payment URL if configured
      let paymentUrl: string | undefined
      if (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI) {
        try {
          paymentUrl = constructDugsiPaymentUrl({
            parentEmail: validated.parent1Email,
            familyId,
            childCount: createdChildren.length,
          })
        } catch (error) {
          console.warn('Could not generate payment URL:', error)
          // Continue without payment URL - registration should still succeed
        }
      }

      return {
        success: true,
        data: {
          children: createdChildren,
          count: createdChildren.length,
          paymentUrl,
          familyId,
        },
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
  try {
    const student = await prisma.student.findFirst({
      where: { parentEmail: email },
      select: { id: true },
    })
    return !!student
  } catch (error) {
    console.error('[checkParentEmailExists] Error:', error)
    // Return false on error to allow registration to proceed
    // The database constraint will catch duplicates anyway
    return false
  }
}
