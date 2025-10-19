'use server'

/**
 * Dugsi Registration Server Actions
 *
 * Direct Server Actions for parent-led registration (K-12 children).
 * Follows the same pattern as app/batches/actions.ts
 */

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { prisma } from '@/lib/db'
import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'
import {
  capitalizeNames,
  formatFullName,
} from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
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
 */
export async function registerDugsiChildren(
  input: z.infer<typeof dugsiRegistrationSchema>
): Promise<
  ActionResult<{
    children: Array<{ id: string; name: string }>
    count: number
  }>
> {
  try {
    const validated = dugsiRegistrationSchema.parse(input)

    return await prisma.$transaction(async (tx) => {
      // 1. Capitalize parent names
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

      // 2. Create all children (database will enforce uniqueness)
      const createdChildren = []

      for (const child of validated.children) {
        const childFullName = formatFullName(child.firstName, child.lastName)

        // Create student record with parent contact info
        // Database constraints will prevent duplicates
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

      // 3. Create sibling group if multiple children
      if (createdChildren.length > 1) {
        await tx.sibling.create({
          data: {
            Student: {
              connect: createdChildren.map((child) => ({ id: child.id })),
            },
          },
        })
      }

      return {
        success: true,
        data: {
          children: createdChildren,
          count: createdChildren.length,
        },
      }
    })
  } catch (error) {
    console.error('[registerDugsiChildren] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    }
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
    return false
  }
}
