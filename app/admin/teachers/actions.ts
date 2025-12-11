'use server'

import { revalidatePath } from 'next/cache'

import { Prisma, Program } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  mapPersonToSearchResult,
  PersonSearchResult,
} from '@/lib/mappers/person-mapper'
import {
  createTeacher,
  deleteTeacher,
  assignTeacherToProgram,
  removeTeacherFromProgram,
  bulkAssignPrograms,
  getAllTeachers,
  getTeacherPrograms,
} from '@/lib/services/shared/teacher-service'
import { ValidationError } from '@/lib/services/validation-service'
import { normalizePhone } from '@/lib/types/person'
import { ActionResult } from '@/lib/utils/action-helpers'
import { extractContactInfo } from '@/lib/utils/contact-helpers'

const logger = createServiceLogger('teacher-admin-actions')

// Search configuration
const SEARCH_MIN_LENGTH = 2
const SEARCH_MAX_RESULTS = 20

// Re-export PersonSearchResult for client components
export type { PersonSearchResult }

// ============================================================================
// Types
// ============================================================================

export interface TeacherWithDetails {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  programs: Program[]
  studentCount: number
  createdAt: Date
}

export interface CreateTeacherInput {
  personId: string
}

export interface CreateTeacherWithPersonInput {
  name: string
  email?: string
  phone?: string
}

export interface ProgramAssignmentInput {
  teacherId: string
  program: Program
}

export interface BulkProgramAssignmentInput {
  teacherId: string
  programs: Program[]
}

// ============================================================================
// Validation Schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid ID format')

const createTeacherSchema = z.object({
  personId: uuidSchema,
})

const deleteTeacherSchema = z.object({
  teacherId: uuidSchema,
})

const getTeacherProgramsSchema = z.object({
  teacherId: uuidSchema,
})

// ============================================================================
// Teacher CRUD Actions
// ============================================================================

/**
 * Get all teachers with their details.
 * Optionally filter by program.
 */
export async function getTeachers(
  program?: Program
): Promise<ActionResult<TeacherWithDetails[]>> {
  try {
    const teachers = await getAllTeachers(program)

    // Get all teacher IDs
    const teacherIds = teachers.map((t) => t.id)

    // Get all student counts in ONE query (fixes N+1)
    const studentCounts = await prisma.teacherAssignment.groupBy({
      by: ['teacherId'],
      where: {
        teacherId: { in: teacherIds },
        isActive: true,
      },
      _count: { id: true },
    })

    // Create lookup map
    const countMap = new Map(
      studentCounts.map((sc) => [sc.teacherId, sc._count.id])
    )

    // Map teachers (synchronous - no async needed)
    const teachersWithDetails = teachers.map((teacher) => {
      const { email, phone } = extractContactInfo(
        teacher.person.contactPoints || []
      )

      return {
        id: teacher.id,
        personId: teacher.personId,
        name: teacher.person.name,
        email,
        phone,
        programs: teacher.programs
          .filter((p) => p.isActive)
          .map((p) => p.program),
        studentCount: countMap.get(teacher.id) ?? 0,
        createdAt: teacher.createdAt,
      }
    })

    return { success: true, data: teachersWithDetails }
  } catch (error) {
    await logError(logger, error, 'Failed to get teachers')
    return {
      success: false,
      error: 'Failed to load teachers',
    }
  }
}

/**
 * Create a new teacher from an existing person.
 */
export async function createTeacherAction(
  rawInput: unknown
): Promise<ActionResult<{ teacherId: string }>> {
  const parsed = createTeacherSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const input = parsed.data

  try {
    const teacher = await createTeacher(input.personId)

    revalidatePath('/admin/teachers')

    logger.info(
      {
        teacherId: teacher.id,
        personId: input.personId,
        name: teacher.person.name,
      },
      'Teacher created'
    )

    return {
      success: true,
      data: { teacherId: teacher.id },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to create teacher', {
      personId: input.personId,
    })

    if (
      error instanceof ValidationError &&
      error.code === 'TEACHER_ALREADY_EXISTS'
    ) {
      return {
        success: false,
        error: 'This person is already a teacher',
      }
    }

    return {
      success: false,
      error: 'Failed to create teacher',
    }
  }
}

/**
 * Create a new teacher by first creating a person.
 */
export async function createTeacherWithPersonAction(
  input: CreateTeacherWithPersonInput
): Promise<ActionResult<{ teacherId: string }>> {
  try {
    const contactPoints: Array<{
      type: 'EMAIL' | 'PHONE'
      value: string
      isPrimary: boolean
    }> = []

    if (input.email) {
      contactPoints.push({
        type: 'EMAIL',
        value: input.email,
        isPrimary: true,
      })
    }

    if (input.phone) {
      const normalizedPhone = normalizePhone(input.phone)
      if (normalizedPhone) {
        contactPoints.push({
          type: 'PHONE',
          value: normalizedPhone,
          isPrimary: !input.email,
        })
      }
    }

    // Use transaction to ensure atomicity (prevents orphaned Person on failure)
    const teacher = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          name: input.name,
          contactPoints: {
            create: contactPoints,
          },
        },
      })

      return createTeacher(person.id, tx)
    })

    revalidatePath('/admin/teachers')

    logger.info(
      {
        teacherId: teacher.id,
        personId: teacher.personId,
        name: teacher.person.name,
      },
      'Teacher created with new person'
    )

    return {
      success: true,
      data: { teacherId: teacher.id },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to create teacher with person', {
      ...input,
    })

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = error.meta?.target as string[] | undefined
        if (target?.includes('type') && target?.includes('value')) {
          return {
            success: false,
            error: 'A person with this email or phone already exists',
          }
        }
      }
    }

    if (
      error instanceof ValidationError &&
      error.code === 'TEACHER_ALREADY_EXISTS'
    ) {
      return {
        success: false,
        error: 'This person is already a teacher',
      }
    }

    return {
      success: false,
      error: 'Failed to create teacher',
    }
  }
}

/**
 * Delete a teacher (soft delete).
 */
export async function deleteTeacherAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = deleteTeacherSchema.safeParse({ teacherId: rawInput })
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const { teacherId } = parsed.data

  try {
    await deleteTeacher(teacherId)

    revalidatePath('/admin/teachers')

    logger.info({ teacherId }, 'Teacher deleted')

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to delete teacher', { teacherId })
    return {
      success: false,
      error: 'Failed to delete teacher',
    }
  }
}

// ============================================================================
// Program Enrollment Actions
// ============================================================================

/**
 * Assign a teacher to a program.
 */
export async function assignTeacherToProgramAction(
  input: ProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    await assignTeacherToProgram(input)

    revalidatePath('/admin/teachers')
    revalidatePath(
      `/admin/${input.program.toLowerCase().replace('_program', '')}`
    )

    logger.info(
      { teacherId: input.teacherId, program: input.program },
      'Teacher assigned to program'
    )

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to assign teacher to program', {
      ...input,
    })

    if (
      error instanceof ValidationError &&
      error.code === 'DUPLICATE_PROGRAM_ENROLLMENT'
    ) {
      return {
        success: false,
        error: 'Teacher is already enrolled in this program',
      }
    }

    return {
      success: false,
      error: 'Failed to assign teacher to program',
    }
  }
}

/**
 * Remove a teacher from a program.
 */
export async function removeTeacherFromProgramAction(
  input: ProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    // Check for active student assignments
    const activeAssignments = await prisma.teacherAssignment.count({
      where: {
        teacherId: input.teacherId,
        isActive: true,
        programProfile: {
          program: input.program,
        },
      },
    })

    if (activeAssignments > 0) {
      return {
        success: false,
        error: `Cannot remove teacher from ${input.program}. They have ${activeAssignments} active student assignment(s). Please reassign students first.`,
      }
    }

    await removeTeacherFromProgram(input)

    revalidatePath('/admin/teachers')
    revalidatePath(
      `/admin/${input.program.toLowerCase().replace('_program', '')}`
    )

    logger.info(
      { teacherId: input.teacherId, program: input.program },
      'Teacher removed from program'
    )

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to remove teacher from program', {
      ...input,
    })
    return {
      success: false,
      error: 'Failed to remove teacher from program',
    }
  }
}

/**
 * Bulk assign programs to a teacher.
 */
export async function bulkAssignProgramsAction(
  input: BulkProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    await bulkAssignPrograms(input.teacherId, input.programs)

    revalidatePath('/admin/teachers')
    input.programs.forEach((program) => {
      revalidatePath(`/admin/${program.toLowerCase().replace('_program', '')}`)
    })

    logger.info(
      {
        teacherId: input.teacherId,
        programs: input.programs,
        count: input.programs.length,
      },
      'Programs bulk assigned to teacher'
    )

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to bulk assign programs', {
      ...input,
    })
    return {
      success: false,
      error: 'Failed to assign programs to teacher',
    }
  }
}

/**
 * Get programs a teacher is enrolled in.
 */
export async function getTeacherProgramsAction(
  rawInput: unknown
): Promise<ActionResult<Program[]>> {
  const parsed = getTeacherProgramsSchema.safeParse({ teacherId: rawInput })
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const { teacherId } = parsed.data

  try {
    const programs = await getTeacherPrograms(teacherId)

    return {
      success: true,
      data: programs.map((p) => p.program),
    }
  } catch (error) {
    await logError(logger, error, 'Failed to get teacher programs', {
      teacherId,
    })
    return {
      success: false,
      error: 'Failed to load teacher programs',
    }
  }
}

/**
 * Search for people by name, email, or phone.
 */
export async function searchPeopleAction(
  query: string
): Promise<ActionResult<PersonSearchResult[]>> {
  try {
    if (!query || query.trim().length < SEARCH_MIN_LENGTH) {
      return { success: true, data: [] }
    }

    const searchTerm = query.trim().toLowerCase()
    const normalizedSearchTerm = normalizePhone(query.trim())

    const people = await prisma.person.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          {
            contactPoints: {
              some: {
                OR: [
                  {
                    type: 'EMAIL',
                    value: { contains: searchTerm, mode: 'insensitive' },
                  },
                  ...(normalizedSearchTerm
                    ? [
                        {
                          type: {
                            in: ['PHONE', 'WHATSAPP'] as (
                              | 'PHONE'
                              | 'WHATSAPP'
                            )[],
                          },
                          value: normalizedSearchTerm,
                        },
                      ]
                    : []),
                ],
              },
            },
          },
        ],
      },
      include: {
        contactPoints: {
          where: { isActive: true },
        },
        teacher: {
          include: {
            programs: {
              where: { isActive: true },
            },
          },
        },
        guardianRelationships: {
          where: { isActive: true },
          include: {
            dependent: {
              include: {
                programProfiles: {
                  select: { program: true },
                },
              },
            },
          },
        },
        programProfiles: {
          where: {
            enrollments: {
              some: {
                status: { in: ['REGISTERED', 'ENROLLED'] },
                endDate: null,
              },
            },
          },
          include: {
            enrollments: {
              where: {
                status: { in: ['REGISTERED', 'ENROLLED'] },
                endDate: null,
              },
              select: {
                status: true,
              },
              take: 1,
            },
          },
        },
      },
      take: SEARCH_MAX_RESULTS,
      orderBy: { name: 'asc' },
    })

    const results: PersonSearchResult[] = people.map((person) =>
      mapPersonToSearchResult(person)
    )

    return { success: true, data: results }
  } catch (error) {
    await logError(logger, error, 'Failed to search people', { query })
    return {
      success: false,
      error: 'Failed to search people',
    }
  }
}
