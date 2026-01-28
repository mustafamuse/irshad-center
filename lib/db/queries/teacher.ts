/**
 * Teacher Query Functions
 *
 * Query functions for Teacher model linked to Person.
 */

import { Prisma } from '@prisma/client'

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

export async function findTeachersByPhoneLastFour(
  lastFour: string,
  client: DatabaseClient = prisma
) {
  return client.teacher.findMany({
    where: {
      person: {
        is: {
          contactPoints: {
            some: {
              type: 'PHONE',
              isActive: true,
              value: { endsWith: lastFour },
            },
          },
        },
      },
    },
    include: {
      person: { select: { name: true } },
    },
  })
}

export async function getTeacherName(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<string | null> {
  const teacher = await client.teacher.findUnique({
    where: { id: teacherId },
    select: { person: { select: { name: true } } },
  })
  return teacher?.person.name ?? null
}

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
