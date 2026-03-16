/**
 * Shared Teacher Service
 *
 * Multi-program teacher management operations.
 * Handles Teacher and TeacherProgram models.
 *
 * Workflow: Create Teacher → Assign to Programs
 *
 * Responsibilities:
 * - Create/delete teachers (promote Person to Teacher role)
 * - Manage program enrollments (TeacherProgram)
 * - Validate program authorization
 */

import { Prisma, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { executeInTransaction } from '@/lib/db/prisma-helpers'
import { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'
import {
  ValidationError,
  validateTeacherCreation,
} from '@/lib/services/validation-service'

const logger = createServiceLogger('teacher')

/**
 * Program enrollment input
 */
export interface ProgramEnrollmentInput {
  teacherId: string
  program: Program
}

// ============================================================================
// Teacher CRUD
// ============================================================================

/**
 * Create a teacher from an existing person.
 * Validates that the person exists and doesn't already have a teacher record.
 *
 * @param personId - Person ID to promote to teacher
 * @param client - Optional database client for transactions
 * @returns Created Teacher record with Person relation
 */
export async function createTeacher(
  personId: string,
  client: DatabaseClient = prisma
) {
  // Validate using existing validation function (pass client for transaction support)
  await validateTeacherCreation({ personId }, client)

  // Create teacher record
  const teacher = await client.teacher.create({
    data: {
      personId,
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      programs: true,
    },
  })

  logger.info(
    {
      event: 'ROLE_ADDED',
      teacherId: teacher.id,
      personId,
      personName: teacher.person.name,
      role: 'TEACHER',
      timestamp: new Date().toISOString(),
    },
    'Person promoted to teacher'
  )

  return teacher
}

/**
 * Soft delete a teacher.
 * Sets all TeacherProgram records to inactive.
 *
 * @param teacherId - Teacher ID to delete
 * @param client - Optional database client for transactions
 */
export async function deleteTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
) {
  await client.teacherProgram.updateMany({
    where: { teacherId },
    data: { isActive: false },
  })

  logger.info({ teacherId }, 'Teacher soft deleted')
}

// ============================================================================
// Program Enrollment
// ============================================================================

/**
 * Assign a teacher to a program.
 * Creates TeacherProgram record allowing teacher to be assigned to students in that program.
 *
 * @param input - Teacher ID and Program
 * @param client - Optional database client for transactions
 * @returns Created TeacherProgram record
 * @throws ValidationError if teacher doesn't exist or already enrolled
 */
export async function assignTeacherToProgram(
  input: ProgramEnrollmentInput,
  client: DatabaseClient = prisma
) {
  const { teacherId, program } = input

  // Check teacher exists
  const teacher = await client.teacher.findUnique({
    relationLoadStrategy: 'join',
    where: { id: teacherId },
    include: {
      person: true,
    },
  })

  if (!teacher) {
    throw new ValidationError('Teacher not found', 'TEACHER_NOT_FOUND', {
      teacherId,
    })
  }

  // Check for existing active enrollment
  const existing = await client.teacherProgram.findUnique({
    where: {
      teacherId_program: {
        teacherId,
        program,
      },
    },
  })

  if (existing && existing.isActive) {
    throw new ValidationError(
      'Teacher already enrolled in this program',
      'DUPLICATE_PROGRAM_ENROLLMENT',
      { teacherId, program }
    )
  }

  // Create or reactivate enrollment
  const teacherProgram = await client.teacherProgram.upsert({
    where: {
      teacherId_program: {
        teacherId,
        program,
      },
    },
    create: {
      teacherId,
      program,
      isActive: true,
    },
    update: {
      isActive: true,
    },
  })

  logger.info(
    {
      teacherId,
      program,
      teacherName: teacher.person.name,
    },
    'Teacher assigned to program'
  )

  return teacherProgram
}

/**
 * Remove a teacher from a program.
 * Soft deletes the TeacherProgram record.
 *
 * @param input - Teacher ID and Program
 * @param client - Optional database client for transactions
 */
export async function removeTeacherFromProgram(
  input: ProgramEnrollmentInput,
  client: DatabaseClient = prisma
) {
  const { teacherId, program } = input

  await client.teacherProgram.updateMany({
    where: {
      teacherId,
      program,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })

  logger.info({ teacherId, program }, 'Teacher removed from program')
}

/**
 * Get programs a teacher is authorized to teach.
 *
 * @param teacherId - Teacher ID
 * @param client - Optional database client
 * @returns Array of active TeacherProgram records
 */
export async function getTeacherPrograms(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<
  { id: string; teacherId: string; program: Program; isActive: boolean }[]
> {
  return client.teacherProgram.findMany({
    where: {
      teacherId,
      isActive: true,
    },
    orderBy: {
      program: 'asc',
    },
  })
}

/**
 * Bulk assign programs to a teacher.
 * Creates multiple TeacherProgram records in a single transaction.
 * Deactivates programs not in the input array (with validation).
 *
 * @param teacherId - Teacher ID
 * @param programs - Array of programs to assign
 * @param client - Optional database client
 */
export async function bulkAssignPrograms(
  teacherId: string,
  programs: Program[],
  client: DatabaseClient = prisma
) {
  if (!programs || programs.length === 0) {
    throw new ValidationError(
      'At least one program is required',
      'EMPTY_PROGRAMS',
      { teacherId }
    )
  }

  const uniquePrograms = new Set(programs)
  if (uniquePrograms.size !== programs.length) {
    throw new ValidationError(
      'Duplicate programs provided',
      'DUPLICATE_PROGRAMS',
      { teacherId, programs }
    )
  }

  // Validate teacher exists before starting transaction
  const teacher = await client.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  })

  if (!teacher) {
    throw new ValidationError('Teacher not found', 'TEACHER_NOT_FOUND', {
      teacherId,
    })
  }

  await executeInTransaction(client, async (tx) => {
    const currentPrograms = await tx.teacherProgram.findMany({
      where: {
        teacherId,
        isActive: true,
      },
      select: { program: true },
    })

    const currentProgramSet = new Set(currentPrograms.map((p) => p.program))
    const newProgramSet = new Set(programs)

    const programsToRemove = currentPrograms
      .map((p) => p.program)
      .filter((p) => !newProgramSet.has(p))

    // Check for Dugsi class assignments before removing from DUGSI_PROGRAM
    if (programsToRemove.includes('DUGSI_PROGRAM' as Program)) {
      const classAssignments = await tx.dugsiClassTeacher.count({
        where: {
          teacherId,
          isActive: true,
        },
      })

      if (classAssignments > 0) {
        throw new ValidationError(
          `Cannot remove teacher from DUGSI_PROGRAM. They are assigned to ${classAssignments} class(es). Please remove class assignments first.`,
          'TEACHER_HAS_ACTIVE_CLASSES',
          { teacherId, program: 'DUGSI_PROGRAM', classAssignments }
        )
      }
    }

    if (programsToRemove.length > 0) {
      await tx.teacherProgram.updateMany({
        where: {
          teacherId,
          program: { in: programsToRemove },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
    }

    await Promise.all(
      programs.map((program) =>
        tx.teacherProgram.upsert({
          where: {
            teacherId_program: {
              teacherId,
              program,
            },
          },
          create: {
            teacherId,
            program,
            isActive: true,
          },
          update: {
            isActive: true,
          },
        })
      )
    )

    logger.info(
      {
        teacherId,
        added: programs.filter((p) => !currentProgramSet.has(p)),
        removed: programsToRemove,
        total: programs.length,
      },
      'Bulk programs assigned to teacher'
    )
  })
}

// ============================================================================
// Teacher Queries
// ============================================================================

const teacherWithDetailsInclude = {
  person: {
    include: {
      contactPoints: true,
    },
  },
  programs: {
    where: { isActive: true },
  },
} satisfies Prisma.TeacherInclude

export type TeacherWithDetails = Prisma.TeacherGetPayload<{
  include: typeof teacherWithDetailsInclude
}>

/**
 * Get all teachers, optionally filtered by program.
 *
 * @param program - Optional program filter
 * @param client - Optional database client
 * @returns Array of teachers with person details
 */
export async function getAllTeachers(
  program?: Program,
  client: DatabaseClient = prisma
): Promise<TeacherWithDetails[]> {
  if (program) {
    // Get teachers enrolled in specific program
    const teacherPrograms = await client.teacherProgram.findMany({
      relationLoadStrategy: 'join',
      where: {
        program,
        isActive: true,
      },
      include: {
        teacher: {
          include: teacherWithDetailsInclude,
        },
      },
      orderBy: {
        teacher: {
          person: {
            name: 'asc',
          },
        },
      },
    })

    return teacherPrograms.map((tp) => tp.teacher)
  }

  // Get all teachers
  return client.teacher.findMany({
    relationLoadStrategy: 'join',
    include: teacherWithDetailsInclude,
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })
}

/**
 * Get teachers authorized for a specific program.
 *
 * @param program - Program to filter by
 * @param client - Optional database client
 * @returns Array of teachers enrolled in the program
 */
export async function getTeachersByProgram(
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherWithDetails[]> {
  return getAllTeachers(program, client)
}

// ============================================================================
// Program Authorization
// ============================================================================

/**
 * Validate teacher is authorized for a program.
 *
 * @param teacherId - Teacher ID
 * @param program - Program to check
 * @param client - Optional database client
 * @throws ValidationError if teacher not enrolled in program
 */
export async function validateTeacherForProgram(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
) {
  const enrollment = await client.teacherProgram.findFirst({
    where: {
      teacherId,
      program,
      isActive: true,
    },
  })

  if (!enrollment) {
    throw new ValidationError(
      `Teacher is not enrolled in ${program}`,
      'TEACHER_NOT_ENROLLED',
      { teacherId, program }
    )
  }
}
