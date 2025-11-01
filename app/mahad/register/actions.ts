'use server'

/**
 * Mahad Registration Server Actions
 *
 * Direct Server Actions for student self-registration (college-age).
 * Follows the same pattern as app/admin/mahad/cohorts/actions.ts
 */

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { prisma } from '@/lib/db'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SIBLING_GROUP_SIZE = 15

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
// PRISMA SELECTORS (inline instead of separate file)
// ============================================================================

const studentSelectors = {
  basic: {
    id: true,
    name: true,
  },
  withSiblings: {
    id: true,
    name: true,
    email: true,
    phone: true,
    dateOfBirth: true,
    educationLevel: true,
    gradeLevel: true,
    schoolName: true,
    updatedAt: true,
    Sibling: {
      select: {
        Student: {
          select: { id: true, name: true },
        },
      },
    },
  },
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
// Note: Duplicate checking is now handled by database constraints
// See: prisma/migrations/20251011141141_add_unique_constraints_duplicates

// ============================================================================
// REGISTRATION ACTIONS
// ============================================================================

/**
 * Register a new Mahad student with optional siblings
 */
export async function registerStudent(input: {
  studentData: z.infer<typeof mahadRegistrationSchema>
  siblingIds: string[] | null
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const validated = mahadRegistrationSchema.parse(input.studentData)

    return await prisma.$transaction(async (tx) => {
      // 1. Format and capitalize names
      const fullName = formatFullName(validated.firstName, validated.lastName)

      // 2. Prepare sibling group logic (duplicates handled by database constraints)
      let siblingGroupId: string | null = null
      if (input.siblingIds && input.siblingIds.length > 0) {
        // Find existing sibling group from provided IDs
        const existingSibling = await tx.student.findFirst({
          where: {
            id: { in: input.siblingIds },
            siblingGroupId: { not: null },
          },
          select: { siblingGroupId: true },
        })

        if (existingSibling?.siblingGroupId) {
          // Use existing group
          siblingGroupId = existingSibling.siblingGroupId

          // Check group size
          const groupSize = await tx.student.count({
            where: { siblingGroupId },
          })

          if (groupSize >= MAX_SIBLING_GROUP_SIZE) {
            throw new Error(
              `Cannot add to sibling group: maximum size (${MAX_SIBLING_GROUP_SIZE}) reached`
            )
          }
        }
      }

      // 3. Create student (database will enforce uniqueness)
      let student
      try {
        student = await tx.student.create({
          data: {
            name: fullName,
            email: validated.email,
            phone: validated.phone,
            dateOfBirth: validated.dateOfBirth,
            educationLevel: validated.educationLevel,
            gradeLevel: validated.gradeLevel,
            schoolName: validated.schoolName,
            siblingGroupId,
            program: 'MAHAD_PROGRAM',
          },
          select: { id: true, name: true },
        })
      } catch (createError) {
        // Handle unique constraint violations from database
        const duplicateError = handlePrismaUniqueError(createError, {
          name: fullName,
          email: validated.email,
          phone: validated.phone,
        })

        if (duplicateError) {
          return {
            success: false,
            error: duplicateError.message,
            field: duplicateError.field,
          }
        }

        // Re-throw if not a duplicate error
        throw createError
      }

      // 4. Create sibling group if needed
      if (input.siblingIds && input.siblingIds.length > 0 && !siblingGroupId) {
        const newGroup = await tx.sibling.create({
          data: {
            Student: {
              connect: [
                { id: student.id },
                ...input.siblingIds.map((id) => ({ id })),
              ],
            },
          },
        })

        await tx.student.update({
          where: { id: student.id },
          data: { siblingGroupId: newGroup.id },
        })
      }

      return { success: true, data: student }
    })
  } catch (error) {
    console.error('[registerStudent] Error:', error)
    const isDuplicateError =
      error && typeof error === 'object' && 'field' in error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
      field: isDuplicateError
        ? (
            error as {
              field?:
                | 'email'
                | 'phone'
                | 'firstName'
                | 'lastName'
                | 'dateOfBirth'
            }
          ).field
        : undefined,
    }
  } finally {
    revalidatePath('/mahad/register')
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Check if email already exists
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const student = await prisma.student.findFirst({
      where: { email },
      select: { id: true },
    })
    return !!student
  } catch (error) {
    console.error('[checkEmailExists] Error:', error)
    return false
  }
}

/**
 * Search students by name for sibling matching
 */
export async function searchStudents(query: string, lastName: string) {
  try {
    const students = await prisma.student.findMany({
      where: {
        AND: [
          { name: { contains: query, mode: 'insensitive' } },
          { name: { endsWith: lastName, mode: 'insensitive' } },
        ],
      },
      select: studentSelectors.basic,
      orderBy: { name: 'asc' },
      take: 20,
    })

    return students.map((s) => ({
      id: s.id,
      name: s.name,
      lastName: s.name.split(' ').slice(-1)[0],
    }))
  } catch (error) {
    console.error('[searchStudents] Error:', error)
    return []
  }
}

/**
 * Add sibling relationship
 */
export async function addSibling(
  studentId: string,
  siblingId: string
): Promise<ActionResult> {
  if (studentId === siblingId) {
    return { success: false, error: 'Cannot add student as their own sibling' }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const [student, sibling] = await Promise.all([
        tx.student.findUnique({
          where: { id: studentId },
          select: { siblingGroupId: true },
        }),
        tx.student.findUnique({
          where: { id: siblingId },
          select: { siblingGroupId: true },
        }),
      ])

      if (!student || !sibling) {
        return { success: false, error: 'Student not found' }
      }

      // Neither has group - create new
      if (!student.siblingGroupId && !sibling.siblingGroupId) {
        await tx.sibling.create({
          data: {
            Student: {
              connect: [{ id: studentId }, { id: siblingId }],
            },
          },
        })
      }
      // Student has group - add sibling to it
      else if (student.siblingGroupId) {
        await tx.student.update({
          where: { id: siblingId },
          data: { siblingGroupId: student.siblingGroupId },
        })
      }
      // Sibling has group - add student to it
      else if (sibling.siblingGroupId) {
        await tx.student.update({
          where: { id: studentId },
          data: { siblingGroupId: sibling.siblingGroupId },
        })
      }

      return { success: true }
    })
  } catch (error) {
    console.error('[addSibling] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add sibling',
    }
  } finally {
    revalidatePath('/mahad/register')
  }
}

/**
 * Remove sibling relationship
 */
export async function removeSibling(
  studentId: string,
  siblingId: string
): Promise<ActionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { siblingGroupId: true },
      })

      if (!student?.siblingGroupId) {
        return { success: false, error: 'Sibling group not found' }
      }

      const groupSize = await tx.student.count({
        where: { siblingGroupId: student.siblingGroupId },
      })

      if (groupSize <= 2) {
        // Delete entire group
        await Promise.all([
          tx.student.updateMany({
            where: { siblingGroupId: student.siblingGroupId },
            data: { siblingGroupId: null },
          }),
          tx.sibling.delete({ where: { id: student.siblingGroupId } }),
        ])
      } else {
        // Just remove the one sibling
        await tx.student.update({
          where: { id: siblingId },
          data: { siblingGroupId: null },
        })
      }

      return { success: true }
    })
  } catch (error) {
    console.error('[removeSibling] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to remove sibling',
    }
  } finally {
    revalidatePath('/mahad/register')
  }
}
