/**
 * Shared Teacher Service
 *
 * Multi-program teacher management operations.
 * Handles Teacher, TeacherProgram, and TeacherAssignment models.
 *
 * Workflow: Create Teacher → Assign Programs → Assign Students
 *
 * Responsibilities:
 * - Create/delete teachers (promote Person to Teacher role)
 * - Manage program enrollments (TeacherProgram)
 * - Assign teachers to students (TeacherAssignment)
 * - Validate program authorization before assignment
 * - Handle shift requirements per program (Dugsi requires shift, Mahad does not)
 */

import { Prisma, Program, Shift } from '@prisma/client'

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

/**
 * Student assignment input
 */
export interface StudentAssignmentInput {
  teacherId: string
  programProfileId: string
  shift?: Shift | null
  startDate?: Date
  notes?: string
}

/**
 * Bulk student assignment input
 */
export interface BulkAssignmentInput {
  teacherId: string
  programProfileId: string
  shift?: Shift | null
}

/**
 * Bulk assignment result
 */
export interface BulkAssignmentResult {
  created: number
  skipped: number
  errors: Array<{
    programProfileId: string
    error: string
  }>
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
  // Validate using existing validation function
  await validateTeacherCreation({ personId })

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
 * Sets all TeacherProgram and TeacherAssignment records to inactive.
 *
 * @param teacherId - Teacher ID to delete
 * @param client - Optional database client for transactions
 */
export async function deleteTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
) {
  await executeInTransaction(client, async (tx) => {
    // Deactivate all program enrollments
    await tx.teacherProgram.updateMany({
      where: { teacherId },
      data: { isActive: false },
    })

    // Deactivate all student assignments
    await tx.teacherAssignment.updateMany({
      where: { teacherId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    })
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

    // Check all programs at once instead of N queries
    if (programsToRemove.length > 0) {
      const assignmentCounts = await tx.teacherAssignment.groupBy({
        by: ['programProfileId'],
        where: {
          teacherId,
          isActive: true,
          programProfile: {
            program: { in: programsToRemove },
          },
        },
        _count: { _all: true },
      })

      // Get the program for each profile that has assignments
      if (assignmentCounts.length > 0) {
        const profileIds = assignmentCounts.map((a) => a.programProfileId)
        const profiles = await tx.programProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, program: true },
        })

        const programCounts: Record<string, number> = {}
        for (const count of assignmentCounts) {
          const profile = profiles.find((p) => p.id === count.programProfileId)
          if (profile) {
            programCounts[profile.program] =
              (programCounts[profile.program] || 0) + count._count._all
          }
        }

        for (const program of Object.keys(programCounts)) {
          const activeAssignments = programCounts[program]
          throw new ValidationError(
            `Cannot remove teacher from ${program}. They have ${activeAssignments} active student assignment(s). Please reassign students first.`,
            'TEACHER_HAS_ACTIVE_STUDENTS',
            { teacherId, program, activeAssignments }
          )
        }
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
      where: {
        program,
        isActive: true,
      },
      include: {
        teacher: {
          include: teacherWithDetailsInclude,
        },
      },
    })

    return teacherPrograms.map((tp) => tp.teacher)
  }

  // Get all teachers
  return client.teacher.findMany({
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
// Student Assignment
// ============================================================================

/**
 * Validate shift requirement based on program.
 * Dugsi requires shift, other programs do not.
 *
 * @param program - Program type
 * @param shift - Shift value (can be null)
 * @throws ValidationError if shift validation fails
 */
export function validateShiftRequirement(
  program: Program,
  shift: Shift | null | undefined
) {
  if (program === 'DUGSI_PROGRAM' && !shift) {
    throw new ValidationError(
      'Shift is required for Dugsi program assignments',
      'SHIFT_REQUIRED',
      { program }
    )
  }

  if (program !== 'DUGSI_PROGRAM' && shift) {
    logger.warn(
      { program, shift },
      'Shift provided for non-Dugsi program (will be ignored)'
    )
  }
}

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

/**
 * Assign a teacher to a student.
 * Validates program enrollment and shift requirements before creating assignment.
 *
 * @param input - Assignment data
 * @param client - Optional database client for transactions
 * @returns Created TeacherAssignment with relations
 */
export async function assignTeacherToStudent(
  input: StudentAssignmentInput,
  client: DatabaseClient = prisma
) {
  const { teacherId, programProfileId, shift, startDate, notes } = input

  // Get program profile to determine program
  const profile = await client.programProfile.findUnique({
    where: { id: programProfileId },
  })

  if (!profile) {
    throw new ValidationError(
      'Program profile not found',
      'PROFILE_NOT_FOUND',
      { programProfileId }
    )
  }

  // Validate teacher is enrolled in this program
  await validateTeacherForProgram(teacherId, profile.program, client)

  // Validate shift requirement
  validateShiftRequirement(profile.program, shift ?? null)

  // Check for existing active assignment (early validation)
  const existingAssignment = await client.teacherAssignment.findFirst({
    where: {
      programProfileId,
      isActive: true,
      ...(shift ? { shift } : { shift: null }),
    },
  })

  if (existingAssignment) {
    const message = shift
      ? `Student already has an active ${shift} shift assignment`
      : 'Student already has an active assignment for this program'
    throw new ValidationError(message, 'DUPLICATE_ASSIGNMENT', {
      programProfileId,
      shift,
      existingAssignmentId: existingAssignment.id,
    })
  }

  // Create assignment - catch P2002 (unique constraint) to handle race condition
  let assignment
  try {
    assignment = await client.teacherAssignment.create({
      data: {
        teacherId,
        programProfileId,
        shift: shift ?? null,
        startDate: startDate ?? new Date(),
        notes,
        isActive: true,
      },
      include: {
        teacher: {
          include: {
            person: {
              include: {
                contactPoints: true,
              },
            },
          },
        },
        programProfile: {
          include: {
            person: true,
          },
        },
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.warn(
        {
          meta: error.meta,
          teacherId,
          programProfileId,
          shift,
        },
        'P2002 unique constraint violation in teacher assignment'
      )
      throw new ValidationError(
        'Assignment already exists for this teacher, student, and shift combination',
        'DUPLICATE_ASSIGNMENT',
        { teacherId, programProfileId, shift }
      )
    }
    throw error
  }

  logger.info(
    {
      assignmentId: assignment.id,
      teacherId,
      studentId: profile.personId,
      program: profile.program,
      shift: shift ?? 'none',
    },
    'Teacher assigned to student'
  )

  return assignment
}

/**
 * Reassign a student to a different teacher.
 * Deactivates the old assignment and creates a new one.
 *
 * @param assignmentId - Current assignment ID to replace
 * @param newTeacherId - New teacher ID
 * @param client - Optional database client for transactions
 * @returns New TeacherAssignment record
 */
export async function reassignStudent(
  assignmentId: string,
  newTeacherId: string,
  client: DatabaseClient = prisma
) {
  return executeInTransaction(client, async (tx) => {
    // Get existing assignment
    const oldAssignment = await tx.teacherAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        programProfile: true,
      },
    })

    if (!oldAssignment) {
      throw new ValidationError(
        'Assignment not found',
        'ASSIGNMENT_NOT_FOUND',
        { assignmentId }
      )
    }

    // Deactivate old assignment
    await tx.teacherAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    })

    // Create new assignment with same profile and shift
    const newAssignment = await assignTeacherToStudent(
      {
        teacherId: newTeacherId,
        programProfileId: oldAssignment.programProfileId,
        shift: oldAssignment.shift,
        notes: `Reassigned from previous teacher`,
      },
      tx
    )

    logger.info(
      {
        oldAssignmentId: assignmentId,
        newAssignmentId: newAssignment.id,
        oldTeacherId: oldAssignment.teacherId,
        newTeacherId,
        studentId: oldAssignment.programProfile.personId,
      },
      'Student reassigned to new teacher'
    )

    return newAssignment
  })
}

/**
 * Remove a teacher assignment (soft delete).
 * Sets the assignment to inactive and records the end date.
 *
 * @param assignmentId - Assignment ID to remove
 * @param client - Optional database client
 */
export async function removeTeacherAssignment(
  assignmentId: string,
  client: DatabaseClient = prisma
) {
  await client.teacherAssignment.update({
    where: { id: assignmentId },
    data: {
      isActive: false,
      endDate: new Date(),
    },
  })

  logger.info({ assignmentId }, 'Teacher assignment removed')
}

/**
 * Bulk assign students to a teacher.
 * Processes multiple assignments with error handling.
 *
 * @param assignments - Array of assignment inputs
 * @param client - Optional database client
 * @returns Result with counts and errors
 */
export async function bulkAssignStudents(
  assignments: BulkAssignmentInput[],
  client: DatabaseClient = prisma
): Promise<BulkAssignmentResult> {
  const result: BulkAssignmentResult = {
    created: 0,
    skipped: 0,
    errors: [],
  }

  for (const input of assignments) {
    try {
      await assignTeacherToStudent(input, client)
      result.created++
    } catch (error) {
      result.skipped++
      result.errors.push({
        programProfileId: input.programProfileId,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  logger.info(
    {
      total: assignments.length,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
    },
    'Bulk assignment completed'
  )

  return result
}
