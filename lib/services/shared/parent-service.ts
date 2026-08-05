/**
 * Shared Parent/Guardian Service
 *
 * Cross-program guardian/parent management operations.
 *
 * Works with the GuardianRelationship model to manage
 * parent-child relationships across all programs.
 *
 * Responsibilities:
 * - Update guardian information
 * - Add/remove guardian relationships
 * - Validate guardian data
 * - Get guardian's dependents
 */

import { GuardianRole, Prisma } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  createPerson,
  findPersonByEmail,
  findPersonByEmailUnique,
  findPersonByEmailWithActiveDependents,
  findPersonByEmailWithProfiles,
  updatePersonFields,
} from '@/lib/db/queries/person'
import {
  createGuardianRelationshipByRole,
  deactivateGuardianRelationship,
  findActiveGuardianRelationshipByRole,
  findGuardianRelationshipByRole,
  getDependentGuardianRelationships,
  getGuardianDependentRelationships,
  reactivateGuardianRelationshipWithEndDate,
} from '@/lib/db/queries/relationships'
import type { DatabaseClient } from '@/lib/db/types'
import {
  ActionError,
  ERROR_CODES,
  throwIfP2002,
} from '@/lib/errors/action-error'
import { ValidationError } from '@/lib/services/validation-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

/**
 * Guardian update input
 */
export interface GuardianUpdateInput {
  firstName: string
  lastName: string
  email?: string
  phone?: string
}

/**
 * Guardian creation input
 */
export interface GuardianCreateInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  role?: GuardianRole
}

/**
 * Update guardian information (Person record).
 *
 * @param guardianId - Person ID of the guardian
 * @param input - Guardian update data
 * @returns Updated Person record
 */
export async function updateGuardianInfo(
  guardianId: string,
  input: GuardianUpdateInput,
  client: DatabaseClient = prisma
) {
  const fullName = `${input.firstName} ${input.lastName}`.trim()

  if (input.phone && !normalizePhone(input.phone)) {
    throw new ActionError(
      'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
      ERROR_CODES.VALIDATION_ERROR,
      'phone',
      400
    )
  }

  const email =
    input.email !== undefined ? normalizeEmail(input.email) : undefined
  const phone =
    input.phone !== undefined
      ? (normalizePhone(input.phone) ?? null)
      : undefined

  try {
    return await updatePersonFields(
      guardianId,
      { name: fullName, email, phone },
      client
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new ValidationError('Guardian not found', 'GUARDIAN_NOT_FOUND', {
        guardianId,
      })
    }
    throwIfP2002(error)
    throw error
  }
}

/**
 * Add a guardian relationship to a dependent.
 *
 * Creates a new Person for the guardian and links to dependent.
 *
 * @param dependentId - Person ID of the dependent (child/student)
 * @param input - Guardian creation data
 * @returns Created GuardianRelationship
 */
export async function addGuardianRelationship(
  dependentId: string,
  input: GuardianCreateInput
) {
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = normalizePhone(input.phone)

  if (!normalizedEmail) {
    throw new ActionError(
      'Guardian email is required',
      ERROR_CODES.VALIDATION_ERROR,
      'email',
      400
    )
  }

  let guardianPerson = await findPersonByEmail(normalizedEmail)

  if (!guardianPerson) {
    try {
      guardianPerson = await createPerson({
        name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        guardianPerson = await findPersonByEmailUnique(normalizedEmail)
        if (!guardianPerson) throwIfP2002(error)
      } else {
        throw error
      }
    }
  }

  const role = input.role || 'PARENT'

  // Check if relationship already exists
  const existingRelationship = await findGuardianRelationshipByRole(
    guardianPerson.id,
    dependentId,
    role
  )

  if (existingRelationship) {
    // Reactivate if exists but inactive
    if (!existingRelationship.isActive) {
      return await reactivateGuardianRelationshipWithEndDate(
        existingRelationship.id
      )
    }

    return existingRelationship
  }

  // Create new relationship
  return await createGuardianRelationshipByRole(
    guardianPerson.id,
    dependentId,
    role
  )
}

/**
 * Remove (deactivate) a guardian relationship.
 *
 * Sets isActive to false and records end date.
 * Does not delete the relationship (for audit trail).
 *
 * @param guardianId - Person ID of the guardian
 * @param dependentId - Person ID of the dependent
 * @param role - Guardian role (optional, defaults to PARENT)
 * @returns Updated GuardianRelationship
 */
export async function removeGuardianRelationship(
  guardianId: string,
  dependentId: string,
  role: GuardianRole = 'PARENT'
) {
  const relationship = await findActiveGuardianRelationshipByRole(
    guardianId,
    dependentId,
    role
  )

  if (!relationship) {
    throw new ValidationError(
      'Active guardian relationship not found',
      'RELATIONSHIP_NOT_FOUND',
      { guardianId, dependentId, role }
    )
  }

  return await deactivateGuardianRelationship(relationship.id, new Date())
}

/**
 * Get all dependents for a guardian.
 *
 * Returns all children/students that this guardian is responsible for.
 *
 * @param guardianId - Person ID of the guardian
 * @param activeOnly - Only return active relationships
 * @returns Array of dependents with relationships
 */
export async function getGuardianDependents(
  guardianId: string,
  activeOnly: boolean = true
) {
  return await getGuardianDependentRelationships(guardianId, activeOnly)
}

/**
 * Get all guardians for a dependent.
 *
 * Returns all parents/guardians for a child/student.
 *
 * @param dependentId - Person ID of the dependent
 * @param activeOnly - Only return active relationships
 * @returns Array of guardians with relationships
 */
export async function getDependentGuardians(
  dependentId: string,
  activeOnly: boolean = true
) {
  return await getDependentGuardianRelationships(dependentId, activeOnly)
}

/**
 * Validate guardian email uniqueness.
 *
 * Checks if email is already used by another person.
 * Returns the existing person if found.
 *
 * @param email - Email to validate
 * @returns Existing person with this email, or null
 */
export async function validateGuardianEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  return await findPersonByEmailWithProfiles(normalized)
}

/**
 * Check whether a guardian email is attached to at least one child with a
 * non-withdrawn Dugsi profile. Withdrawn-only families must NOT be blocked
 * from re-registering, so a fully withdrawn guardian returns false.
 *
 * @param email - Guardian email address
 * @returns true only if the guardian has an active Dugsi child
 */
export async function guardianHasActiveDugsiChildren(email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const guardian = await findPersonByEmailWithActiveDependents(normalized)
  if (!guardian) return false

  return guardian.dependentRelationships.some((relationship) =>
    relationship.dependent.programProfiles.some(
      (profile) =>
        profile.program === DUGSI_PROGRAM && profile.status !== 'WITHDRAWN'
    )
  )
}
