/**
 * Relationship Query Functions
 *
 * Query functions for GuardianRelationship and SiblingRelationship with validation.
 */

import type { GuardianRole } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

/**
 * Create guardian relationship with validation
 */
export async function createGuardianRelationship(
  data: {
    guardianId: string
    dependentId: string
    role: GuardianRole
    startDate?: Date
    notes?: string | null
  },
  client: DatabaseClient = prisma
) {
  // Import validation dynamically to avoid circular dependencies
  const { validateGuardianRelationship } = await import(
    '@/lib/services/validation-service'
  )

  // Validate before creating
  await validateGuardianRelationship({
    guardianId: data.guardianId,
    dependentId: data.dependentId,
    role: data.role,
  })

  return client.guardianRelationship.create({
    data: {
      guardianId: data.guardianId,
      dependentId: data.dependentId,
      role: data.role,
      startDate: data.startDate || new Date(),
      notes: data.notes,
      isActive: true,
    },
    include: {
      guardian: true,
      dependent: true,
    },
  })
}

/**
 * Clear isPrimaryPayer on all other active guardian relationships for a
 * dependent, excluding the given guardian.
 * @param client - Optional database client (for transaction support)
 */
export async function clearOtherPrimaryPayers(
  dependentId: string,
  excludeGuardianId: string,
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.updateMany({
    where: {
      dependentId,
      guardianId: { not: excludeGuardianId },
      isActive: true,
      isPrimaryPayer: true,
    },
    data: { isPrimaryPayer: false },
  })
}

/**
 * Find a guardian relationship by guardian/dependent pair (any status).
 * @param client - Optional database client (for transaction support)
 */
export async function findGuardianRelationship(
  guardianId: string,
  dependentId: string,
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.findFirst({
    where: { guardianId, dependentId },
  })
}

/**
 * Update arbitrary fields on an existing guardian relationship.
 * @param client - Optional database client (for transaction support)
 */
export async function updateGuardianRelationshipFields(
  relationshipId: string,
  data: {
    isActive?: boolean
    role?: GuardianRole
    notes?: string | null
    isPrimaryPayer?: boolean
  },
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.update({
    where: { id: relationshipId },
    data,
  })
}

/**
 * Create a guardian relationship record without validation. Callers are
 * responsible for calling validateGuardianRelationship first.
 * @param client - Optional database client (for transaction support)
 */
export async function createGuardianRelationshipRecord(
  data: {
    guardianId: string
    dependentId: string
    role: GuardianRole
    notes?: string | null
    isActive: boolean
    isPrimaryPayer: boolean
  },
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.create({ data })
}

/**
 * Find active guardian relationships for a set of guardians, excluding one
 * dependent, with dependent and guardian included. Used for sibling
 * detection via shared guardians.
 * @param client - Optional database client (for transaction support)
 */
export async function findGuardianRelationshipsBySharedGuardians(
  guardianIds: string[],
  excludeDependentId: string,
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.findMany({
    relationLoadStrategy: 'join',
    where: {
      guardianId: { in: guardianIds },
      dependentId: { not: excludeDependentId },
      isActive: true,
    },
    include: {
      dependent: true,
      guardian: true,
    },
  })
}

/**
 * Batch lookup guardian relationships for a set of guardian/dependent pairs.
 * @param client - Optional database client (for transaction support)
 */
export async function findGuardianRelationshipsForPairs(
  pairs: Array<{ guardianPersonId: string; dependentPersonId: string }>,
  client: DatabaseClient = prisma
) {
  if (pairs.length === 0) return []
  return client.guardianRelationship.findMany({
    where: {
      OR: pairs.map((r) => ({
        guardianId: r.guardianPersonId,
        dependentId: r.dependentPersonId,
      })),
    },
  })
}

/**
 * Clear isPrimaryPayer on active guardian relationships for a set of
 * dependents, excluding a set of guardians.
 * @param client - Optional database client (for transaction support)
 */
export async function clearPrimaryPayersNotIn(
  dependentIds: string[],
  excludeGuardianIds: string[],
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.updateMany({
    where: {
      dependentId: { in: dependentIds },
      guardianId: { notIn: excludeGuardianIds },
      isActive: true,
      isPrimaryPayer: true,
    },
    data: { isPrimaryPayer: false },
  })
}

/**
 * Batch create guardian relationships, skipping duplicates.
 * @param client - Optional database client (for transaction support)
 */
export async function createGuardianRelationshipsBatchRecords(
  data: Array<{
    guardianId: string
    dependentId: string
    role: GuardianRole
    isPrimaryPayer: boolean
    isActive: boolean
  }>,
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.createMany({
    data,
    skipDuplicates: true,
  })
}

/**
 * Reactivate a set of guardian relationships by ID.
 * @param client - Optional database client (for transaction support)
 */
export async function reactivateGuardianRelationshipsByIds(
  ids: string[],
  client: DatabaseClient = prisma
) {
  return client.guardianRelationship.updateMany({
    where: { id: { in: ids } },
    data: { isActive: true },
  })
}

/**
 * Create sibling relationship with validation
 */
export async function createSiblingRelationship(
  data: {
    person1Id: string
    person2Id: string
    detectionMethod?: string
    confidence?: number | null
    verifiedBy?: string | null
    notes?: string | null
  },
  client: DatabaseClient = prisma
) {
  // Import validation dynamically to avoid circular dependencies
  const { validateSiblingRelationship } = await import(
    '@/lib/services/validation-service'
  )

  // Ensure proper ordering (person1Id < person2Id)
  const orderedData = {
    person1Id:
      data.person1Id < data.person2Id ? data.person1Id : data.person2Id,
    person2Id:
      data.person1Id < data.person2Id ? data.person2Id : data.person1Id,
    detectionMethod: data.detectionMethod || 'MANUAL',
    confidence: data.confidence,
    verifiedBy: data.verifiedBy,
    notes: data.notes,
  }

  // Validate before creating
  await validateSiblingRelationship({
    person1Id: orderedData.person1Id,
    person2Id: orderedData.person2Id,
  })

  return client.siblingRelationship.create({
    data: {
      person1Id: orderedData.person1Id,
      person2Id: orderedData.person2Id,
      detectionMethod: orderedData.detectionMethod,
      confidence: orderedData.confidence,
      verifiedBy: orderedData.verifiedBy,
      notes: orderedData.notes,
      isActive: true,
    },
    include: {
      person1: true,
      person2: true,
    },
  })
}

/**
 * Create teacher with validation
 */
export async function createTeacher(
  data: { personId: string },
  client: DatabaseClient = prisma
) {
  // Import validation dynamically to avoid circular dependencies
  const { validateTeacherCreation } = await import(
    '@/lib/services/validation-service'
  )

  // Validate before creating
  await validateTeacherCreation({
    personId: data.personId,
  })

  return client.teacher.create({
    data: {
      personId: data.personId,
    },
    include: {
      person: true,
    },
  })
}
