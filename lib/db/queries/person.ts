/**
 * Person Query Functions
 *
 * Query functions for Person entity and multi-role scenarios
 */

import { Prisma, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

/**
 * Get people with multiple roles across the system
 * Useful for identifying staff/students/parents with multiple roles for policy decisions
 */
export async function getMultiRolePeople(
  filters?: {
    minRoles?: number
    hasTeacher?: boolean
    hasStudent?: boolean
    hasParent?: boolean
    program?: Program
  },
  client: DatabaseClient = prisma
) {
  const {
    minRoles = 2,
    hasTeacher,
    hasStudent,
    hasParent,
    program,
  } = filters || {}

  const where: Prisma.PersonWhereInput = {}

  if (hasTeacher) {
    where.teacher = { isNot: null }
  }

  if (hasStudent) {
    where.programProfiles = { some: {} }
  }

  if (hasParent) {
    where.guardianRelationships = { some: { isActive: true } }
  }

  const people = await client.person.findMany({
    where,
    relationLoadStrategy: 'join',
    include: {
      teacher: {
        include: {
          programs: {
            where: { isActive: true },
            select: { program: true },
          },
        },
      },
      programProfiles: {
        where: program ? { program } : {},
        include: {
          enrollments: {
            where: { status: { not: 'WITHDRAWN' }, endDate: null },
            take: 1,
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
      contactPoints: {
        where: { isActive: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Filter by role count
  return people.filter((person) => {
    let roleCount = 0
    if (person.teacher) roleCount++
    if (person.programProfiles.length > 0) roleCount++
    if (person.guardianRelationships.length > 0) roleCount++
    return roleCount >= minRoles
  })
}
