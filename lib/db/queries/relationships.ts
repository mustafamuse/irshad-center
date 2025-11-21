/**
 * Relationship Query Functions
 *
 * Query functions for GuardianRelationship and SiblingRelationship with validation.
 */

import type { GuardianRole } from '@prisma/client'

import { prisma } from '@/lib/db'

/**
 * Create guardian relationship with validation
 */
export async function createGuardianRelationship(data: {
  guardianId: string
  dependentId: string
  role: GuardianRole
  startDate?: Date
  notes?: string | null
}) {
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

  return prisma.guardianRelationship.create({
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
 * Create sibling relationship with validation
 */
export async function createSiblingRelationship(data: {
  person1Id: string
  person2Id: string
  detectionMethod?: string
  confidence?: number | null
  verifiedBy?: string | null
  notes?: string | null
}) {
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

  return prisma.siblingRelationship.create({
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
export async function createTeacher(data: { personId: string }) {
  // Import validation dynamically to avoid circular dependencies
  const { validateTeacherCreation } = await import(
    '@/lib/services/validation-service'
  )

  // Validate before creating
  await validateTeacherCreation({
    personId: data.personId,
  })

  return prisma.teacher.create({
    data: {
      personId: data.personId,
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
    },
  })
}
