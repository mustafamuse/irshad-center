/**
 * Teacher Query Functions
 *
 * Query functions for Teacher model linked to Person.
 */

import { Prisma, Program, Shift, TeacherProgram } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import type {
  TeacherWithPerson,
  TeacherWithPersonRelations,
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
    relationLoadStrategy: 'join',
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
    relationLoadStrategy: 'join',
    include: {
      person: true,
    },
  })
}

/**
 * Get teacher with full Person relations (email, phone, etc.)
 * @param client - Optional database client (for transaction support)
 */
export async function getTeacherWithPersonRelations(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherWithPersonRelations | null> {
  return client.teacher.findUnique({
    where: { id: teacherId },
    relationLoadStrategy: 'join',
    include: {
      person: {
        include: {
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
    relationLoadStrategy: 'join',
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

export async function getTeacherDugsiProgram(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherProgram | null> {
  return client.teacherProgram.findFirst({
    where: { teacherId, program: Program.DUGSI_PROGRAM, isActive: true },
  })
}

export async function updateTeacherProgramShifts(
  teacherProgramId: string,
  shifts: Shift[],
  client: DatabaseClient = prisma
): Promise<void> {
  await client.teacherProgram.update({
    where: { id: teacherProgramId },
    data: { shifts },
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
 * Teacher with Person and active Programs.
 */
export const teacherWithDetailsInclude = {
  person: true,
  programs: {
    where: { isActive: true },
  },
} satisfies Prisma.TeacherInclude

export type TeacherWithDetails = Prisma.TeacherGetPayload<{
  include: typeof teacherWithDetailsInclude
}>

/**
 * Create a Teacher record for an existing Person, with Person and Programs included.
 * @param client - Optional database client (for transaction support)
 */
export async function createTeacherWithDetails(
  personId: string,
  client: DatabaseClient = prisma
): Promise<TeacherWithDetails> {
  return client.teacher.create({
    data: { personId },
    include: {
      person: true,
      programs: true,
    },
  })
}

/**
 * Deactivate all TeacherProgram records for a teacher.
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateAllTeacherPrograms(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<{ count: number }> {
  return client.teacherProgram.updateMany({
    where: { teacherId },
    data: { isActive: false },
  })
}

/**
 * Find a teacher's TeacherProgram enrollment for a given program (active or not).
 * @param client - Optional database client (for transaction support)
 */
export async function findTeacherProgramEnrollment(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherProgram | null> {
  return client.teacherProgram.findUnique({
    where: {
      teacherId_program: {
        teacherId,
        program,
      },
    },
  })
}

/**
 * Create or reactivate a teacher's enrollment in a program.
 * @param client - Optional database client (for transaction support)
 */
export async function upsertActiveTeacherProgram(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherProgram> {
  return client.teacherProgram.upsert({
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
}

/**
 * Deactivate a teacher's active enrollment in a single program.
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateTeacherProgram(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
): Promise<{ count: number }> {
  return client.teacherProgram.updateMany({
    where: {
      teacherId,
      program,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })
}

/**
 * Deactivate a teacher's active enrollment in multiple programs.
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateTeacherPrograms(
  teacherId: string,
  programs: Program[],
  client: DatabaseClient = prisma
): Promise<{ count: number }> {
  return client.teacherProgram.updateMany({
    where: {
      teacherId,
      program: { in: programs },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })
}

/**
 * Get a teacher's active TeacherProgram records, ordered by program.
 * @param client - Optional database client (for transaction support)
 */
export async function getActiveTeacherPrograms(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherProgram[]> {
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
 * Get the program names of a teacher's active TeacherProgram records.
 * @param client - Optional database client (for transaction support)
 */
export async function getActiveTeacherProgramNames(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<{ program: Program }[]> {
  return client.teacherProgram.findMany({
    where: {
      teacherId,
      isActive: true,
    },
    select: { program: true },
  })
}

/**
 * Check whether a Teacher exists by ID, returning only the ID.
 * @param client - Optional database client (for transaction support)
 */
export async function findTeacherIdById(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<{ id: string } | null> {
  return client.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  })
}

/**
 * Get teachers enrolled in a specific program, with Person and active Programs.
 * @param client - Optional database client (for transaction support)
 */
export async function getTeachersByProgramWithDetails(
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherWithDetails[]> {
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

/**
 * Get all teachers with Person and active Programs.
 * @param client - Optional database client (for transaction support)
 */
export async function getAllTeachersWithDetails(
  client: DatabaseClient = prisma
): Promise<TeacherWithDetails[]> {
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
 * Create a TeacherProgram enrollment record (active by default).
 * @param client - Optional database client (for transaction support)
 */
export async function createTeacherProgramEnrollment(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherProgram> {
  return client.teacherProgram.create({
    data: { teacherId, program },
  })
}

/**
 * Deactivate a teacher's active DUGSI_PROGRAM enrollment and clear its shifts.
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateTeacherDugsiProgramShifts(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<{ count: number }> {
  return client.teacherProgram.updateMany({
    where: { teacherId, program: Program.DUGSI_PROGRAM, isActive: true },
    data: { shifts: [], isActive: false },
  })
}

/**
 * Find a teacher's active enrollment in a program (full record).
 * @param client - Optional database client (for transaction support)
 */
export async function findActiveTeacherProgramEnrollment(
  teacherId: string,
  program: Program,
  client: DatabaseClient = prisma
): Promise<TeacherProgram | null> {
  return client.teacherProgram.findFirst({
    where: {
      teacherId,
      program,
      isActive: true,
    },
  })
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
