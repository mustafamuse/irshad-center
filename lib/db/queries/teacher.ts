/**
 * Teacher Query Functions
 *
 * Query functions for Teacher model linked to Person.
 * Teachers can teach in multiple programs (Dugsi, Mahad, etc.) via assignments.
 */

import { Prisma, Shift, Program } from '@prisma/client'
import { prisma } from '@/lib/db'
import type {
  TeacherWithPerson,
  TeacherWithPersonRelations,
  TeacherAssignmentWithRelations,
  TeacherAssignmentWithFullRelations,
  TeacherWithAssignments,
  TeacherWithFullAssignments,
} from '@/lib/types/teacher'

/**
 * Get teacher by ID with Person relation
 */
export async function getTeacherById(
  teacherId: string
): Promise<TeacherWithPerson | null> {
  return prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      person: true,
    },
  })
}

/**
 * Get teacher by Person ID
 */
export async function getTeacherByPersonId(
  personId: string
): Promise<TeacherWithPerson | null> {
  return prisma.teacher.findUnique({
    where: { personId },
    include: {
      person: true,
    },
  })
}

/**
 * Get teacher with full Person relations (contact points, etc.)
 */
export async function getTeacherWithPersonRelations(
  teacherId: string
): Promise<TeacherWithPersonRelations | null> {
  return prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      person: {
        include: {
          contactPoints: true,
          guardianRelationships: true,
          dependentRelationships: true,
        },
      },
    },
  })
}

/**
 * Get all teachers with Person relations
 */
export async function getAllTeachers(params?: {
  search?: string
  page?: number
  limit?: number
}): Promise<TeacherWithPerson[]> {
  const { search, page = 1, limit = 50 } = params || {}
  const skip = (page - 1) * limit

  const where: Prisma.TeacherWhereInput = {}

  if (search && search.trim()) {
    const searchTerm = search.trim()
    where.person = {
      name: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    }
  }

  return prisma.teacher.findMany({
    where,
    include: {
      person: true,
    },
    skip,
    take: limit,
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })
}

/**
 * Get teacher assignments for a specific teacher
 */
export async function getTeacherAssignments(
  teacherId: string,
  params?: {
    shift?: Shift
    isActive?: boolean
    includeRelations?: boolean
  }
): Promise<TeacherAssignmentWithRelations[] | TeacherAssignmentWithFullRelations[]> {
  const { shift, isActive, includeRelations = false } = params || {}

  const where: Prisma.TeacherAssignmentWhereInput = {
    teacherId,
  }

  if (shift) {
    where.shift = shift
  }

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  if (includeRelations) {
    return prisma.teacherAssignment.findMany({
      where,
      include: {
        teacher: {
          include: {
            person: {
              include: {
                contactPoints: true,
                guardianRelationships: true,
                dependentRelationships: true,
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
      orderBy: {
        startDate: 'desc',
      },
    }) as Promise<TeacherAssignmentWithFullRelations[]>
  }

  return prisma.teacherAssignment.findMany({
    where,
    include: {
      teacher: {
        include: {
          person: true,
        },
      },
      programProfile: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  }) as Promise<TeacherAssignmentWithRelations[]>
}

/**
 * Get teacher assignments for a Dugsi student (ProgramProfile)
 */
export async function getStudentTeacherAssignments(
  programProfileId: string,
  params?: {
    shift?: Shift
    isActive?: boolean
  }
): Promise<TeacherAssignmentWithRelations[]> {
  const { shift, isActive } = params || {}

  const where: Prisma.TeacherAssignmentWhereInput = {
    programProfileId,
  }

  if (shift) {
    where.shift = shift
  }

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  return prisma.teacherAssignment.findMany({
    where,
    include: {
      teacher: {
        include: {
          person: true,
        },
      },
      programProfile: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  }) as Promise<TeacherAssignmentWithRelations[]>
}

/**
 * Get all Dugsi teachers by shift
 */
export async function getDugsiTeachersByShift(
  shift: Shift,
  params?: {
    isActive?: boolean
  }
): Promise<TeacherWithFullAssignments[]> {
  const { isActive = true } = params || {}

  const teachers = await prisma.teacher.findMany({
    where: {
      assignments: {
        some: {
          shift,
          isActive,
          programProfile: {
            program: 'DUGSI_PROGRAM',
          },
        },
      },
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      assignments: {
        where: {
          shift,
          isActive,
          programProfile: {
            program: 'DUGSI_PROGRAM',
          },
        },
        include: {
          programProfile: {
            include: {
              person: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      },
    },
    orderBy: {
      person: {
        name: 'asc',
      },
    },
  })

  return teachers as TeacherWithFullAssignments[]
}

/**
 * Get teacher with all assignments
 */
export async function getTeacherWithAssignments(
  teacherId: string,
  params?: {
    shift?: Shift
    program?: Program
    isActive?: boolean
  }
): Promise<TeacherWithAssignments | null> {
  const { shift, program, isActive } = params || {}

  const assignmentWhere: Prisma.TeacherAssignmentWhereInput = {}

  if (shift) {
    assignmentWhere.shift = shift
  }

  if (program) {
    assignmentWhere.programProfile = {
      program,
    }
  }

  if (isActive !== undefined) {
    assignmentWhere.isActive = isActive
  }

  return prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      person: true,
      assignments: {
        where: assignmentWhere,
        include: {
          programProfile: true,
        },
        orderBy: {
          startDate: 'desc',
        },
      },
    },
  })
}

/**
 * Check if a Person is a teacher
 */
export async function isPersonATeacher(personId: string): Promise<boolean> {
  const teacher = await prisma.teacher.findUnique({
    where: { personId },
    select: { id: true },
  })
  return teacher !== null
}

/**
 * Get all roles for a Person (teacher, student, parent, payer)
 */
export async function getPersonRoles(personId: string) {
  const [teacher, programProfiles, guardianRelationships, billingAccounts] =
    await Promise.all([
      prisma.teacher.findUnique({
        where: { personId },
        select: { id: true },
      }),
      prisma.programProfile.findMany({
        where: { personId },
        select: { program: true, status: true },
      }),
      prisma.guardianRelationship.findMany({
        where: { guardianId: personId, isActive: true },
        select: { role: true },
      }),
      prisma.billingAccount.findMany({
        where: { personId },
        select: { id: true },
      }),
    ])

  return {
    isTeacher: teacher !== null,
    isStudent: programProfiles.length > 0,
    studentPrograms: programProfiles.map((p) => p.program),
    isGuardian: guardianRelationships.length > 0,
    guardianRoles: guardianRelationships.map((g) => g.role),
    isPayer: billingAccounts.length > 0,
  }
}

