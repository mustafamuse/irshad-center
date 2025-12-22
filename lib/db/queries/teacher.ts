/**
 * Teacher Query Functions
 *
 * Query functions for Teacher model linked to Person.
 * Teachers can teach in multiple programs (Dugsi, Mahad, etc.) via assignments.
 */

import { Prisma, Shift, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
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
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherById(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherWithPerson | null> {
  return client.teacher.findUnique({
    where: { id: teacherId },
    include: {
      person: true,
    },
  })
}

/**
 * Get teacher by Person ID
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherByPersonId(
  personId: string,
  client: DatabaseClient = prisma
): Promise<TeacherWithPerson | null> {
  return client.teacher.findUnique({
    where: { personId },
    include: {
      person: true,
    },
  })
}

/**
 * Get teacher with full Person relations (contact points, etc.)
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherWithPersonRelations(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherWithPersonRelations | null> {
  return client.teacher.findUnique({
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
 * @param client - Optional database client (for transaction support)
 */
export async function getAllTeachers(
  params?: {
    search?: string
    page?: number
    limit?: number
  },
  client: DatabaseClient = prisma
): Promise<TeacherWithPerson[]> {
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

  return client.teacher.findMany({
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
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherAssignments(
  teacherId: string,
  params?: {
    shift?: Shift
    isActive?: boolean
    includeRelations?: boolean
  },
  client: DatabaseClient = prisma
): Promise<
  TeacherAssignmentWithRelations[] | TeacherAssignmentWithFullRelations[]
> {
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
    return client.teacherAssignment.findMany({
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

  return client.teacherAssignment.findMany({
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
 * @param client - Optional database client (for transaction support)
 */
export async function getStudentTeacherAssignments(
  programProfileId: string,
  params?: {
    shift?: Shift
    isActive?: boolean
  },
  client: DatabaseClient = prisma
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

  return client.teacherAssignment.findMany({
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
 * @param client - Optional database client (for transaction support)
 */
export async function getDugsiTeachersByShift(
  shift: Shift,
  params?: {
    isActive?: boolean
  },
  client: DatabaseClient = prisma
): Promise<TeacherWithFullAssignments[]> {
  const { isActive = true } = params || {}

  const teachers = await client.teacher.findMany({
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
          guardianRelationships: true,
          dependentRelationships: true,
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
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherWithAssignments(
  teacherId: string,
  params?: {
    shift?: Shift
    program?: Program
    isActive?: boolean
  },
  client: DatabaseClient = prisma
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

  return client.teacher.findUnique({
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
 * @param client - Optional database client (for transaction support)
 */
export async function isPersonATeacher(
  personId: string,
  client: DatabaseClient = prisma
): Promise<boolean> {
  const teacher = await client.teacher.findUnique({
    where: { personId },
    select: { id: true },
  })
  return teacher !== null
}

/**
 * DTO for Dugsi teacher with their assigned shifts
 */
export interface DugsiTeacherDTO {
  id: string
  personId: string
  name: string
  shifts: Shift[]
}

/**
 * Get all active Dugsi teachers with their assigned shifts
 * @param client - Optional database client (for transaction support)
 */
export async function getDugsiTeachers(
  client: DatabaseClient = prisma
): Promise<DugsiTeacherDTO[]> {
  const teachers = await client.teacher.findMany({
    where: {
      programs: {
        some: {
          program: 'DUGSI_PROGRAM',
          isActive: true,
        },
      },
    },
    include: {
      person: { select: { id: true, name: true } },
      programs: {
        where: { program: 'DUGSI_PROGRAM', isActive: true },
        select: { shifts: true },
      },
    },
    orderBy: { person: { name: 'asc' } },
  })

  return teachers.map((t) => ({
    id: t.id,
    personId: t.person.id,
    name: t.person.name,
    shifts: t.programs[0]?.shifts ?? [],
  }))
}

/**
 * Get all roles for a Person (teacher, student, parent, payer)
 * @param client - Optional database client (for transaction support)
 */
export async function getPersonRoles(
  personId: string,
  client: DatabaseClient = prisma
) {
  const [teacher, programProfiles, guardianRelationships, billingAccounts] =
    await Promise.all([
      client.teacher.findUnique({
        where: { personId },
        select: { id: true },
      }),
      client.programProfile.findMany({
        where: { personId },
        select: { program: true, status: true },
      }),
      client.guardianRelationship.findMany({
        where: { guardianId: personId, isActive: true },
        select: { role: true },
      }),
      client.billingAccount.findMany({
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
