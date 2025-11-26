/**
 * Shared Parent/Guardian Service
 *
 * Cross-program guardian/parent management operations.
 * Handles Person and ContactPoint updates for guardians.
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

import { ContactType, GuardianRole, Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { ValidationError } from '@/lib/services/validation-service'
import { normalizePhone } from '@/lib/utils/contact-normalization'

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
 * Update guardian information (Person + ContactPoints).
 *
 * Updates:
 * - Person name
 * - Email ContactPoint (if provided)
 * - Phone ContactPoint (if provided)
 *
 * @param guardianId - Person ID of the guardian
 * @param input - Guardian update data
 * @returns Updated Person record
 */
export async function updateGuardianInfo(
  guardianId: string,
  input: GuardianUpdateInput
) {
  // Build full name
  const fullName = `${input.firstName} ${input.lastName}`.trim()

  // Update Person name
  await prisma.person.update({
    where: { id: guardianId },
    data: { name: fullName },
  })

  // Get existing contact points
  const guardian = await prisma.person.findUnique({
    where: { id: guardianId },
    include: { contactPoints: true },
  })

  if (!guardian) {
    throw new ValidationError('Guardian not found', 'GUARDIAN_NOT_FOUND', {
      guardianId,
    })
  }

  // Update email if provided
  if (input.email) {
    const normalizedEmail = input.email.toLowerCase().trim()
    const existingEmail = guardian.contactPoints.find(
      (cp) => cp.type === 'EMAIL'
    )

    if (existingEmail) {
      await prisma.contactPoint.update({
        where: { id: existingEmail.id },
        data: { value: normalizedEmail },
      })
    } else {
      try {
        await prisma.contactPoint.create({
          data: {
            personId: guardianId,
            type: 'EMAIL',
            value: normalizedEmail,
            isPrimary: true,
          },
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Race condition - contact point was created by another request
          const existing = await prisma.contactPoint.findFirst({
            where: { personId: guardianId, type: 'EMAIL' },
          })
          if (existing) {
            await prisma.contactPoint.update({
              where: { id: existing.id },
              data: { value: normalizedEmail, isPrimary: true },
            })
          }
        } else {
          throw error
        }
      }
    }
  }

  // Update phone if provided
  if (input.phone) {
    const normalizedPhone = normalizePhone(input.phone)

    // Only update if we have a valid normalized phone (not null)
    if (normalizedPhone !== null) {
      const existingPhone = guardian.contactPoints.find(
        (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
      )

      if (existingPhone) {
        await prisma.contactPoint.update({
          where: { id: existingPhone.id },
          data: { value: normalizedPhone },
        })
      } else {
        try {
          await prisma.contactPoint.create({
            data: {
              personId: guardianId,
              type: 'PHONE',
              value: normalizedPhone,
            },
          })
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Race condition - contact point was created by another request
            const existing = await prisma.contactPoint.findFirst({
              where: { personId: guardianId, type: 'PHONE' },
            })
            if (existing) {
              await prisma.contactPoint.update({
                where: { id: existing.id },
                data: { value: normalizedPhone },
              })
            }
          } else {
            throw error
          }
        }
      }
    }
  }

  // Return updated guardian
  return await prisma.person.findUnique({
    where: { id: guardianId },
    include: { contactPoints: true },
  })
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
  const normalizedEmail = input.email.toLowerCase().trim()
  const normalizedPhone = normalizePhone(input.phone)

  // Check if guardian Person already exists by email
  let guardianPerson = await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: normalizedEmail,
        },
      },
    },
  })

  // Create guardian Person if doesn't exist
  if (!guardianPerson) {
    const contactPointsToCreate: Array<{
      type: ContactType
      value: string
      isPrimary?: boolean
    }> = [
      {
        type: 'EMAIL',
        value: normalizedEmail,
        isPrimary: true,
      },
    ]

    // Only add phone if it's valid
    if (normalizedPhone) {
      contactPointsToCreate.push({
        type: 'PHONE' as ContactType,
        value: normalizedPhone,
        isPrimary: false,
      })
    }

    guardianPerson = await prisma.person.create({
      data: {
        name: fullName,
        contactPoints: {
          create: contactPointsToCreate,
        },
      },
    })
  }

  // Check if relationship already exists
  const existingRelationship = await prisma.guardianRelationship.findFirst({
    where: {
      guardianId: guardianPerson.id,
      dependentId,
      role: input.role || 'PARENT',
    },
  })

  if (existingRelationship) {
    // Reactivate if exists but inactive
    if (!existingRelationship.isActive) {
      return await prisma.guardianRelationship.update({
        where: { id: existingRelationship.id },
        data: {
          isActive: true,
          endDate: null,
        },
      })
    }

    return existingRelationship
  }

  // Create new relationship
  return await prisma.guardianRelationship.create({
    data: {
      guardianId: guardianPerson.id,
      dependentId,
      role: input.role || 'PARENT',
      isActive: true,
    },
  })
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
  const relationship = await prisma.guardianRelationship.findFirst({
    where: {
      guardianId,
      dependentId,
      role,
      isActive: true,
    },
  })

  if (!relationship) {
    throw new ValidationError(
      'Active guardian relationship not found',
      'RELATIONSHIP_NOT_FOUND',
      { guardianId, dependentId, role }
    )
  }

  return await prisma.guardianRelationship.update({
    where: { id: relationship.id },
    data: {
      isActive: false,
      endDate: new Date(),
    },
  })
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
  const whereClause = activeOnly
    ? { guardianId, isActive: true }
    : { guardianId }

  return await prisma.guardianRelationship.findMany({
    where: whereClause,
    include: {
      dependent: {
        include: {
          contactPoints: true,
          programProfiles: {
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
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
  const whereClause = activeOnly
    ? { dependentId, isActive: true }
    : { dependentId }

  return await prisma.guardianRelationship.findMany({
    where: whereClause,
    include: {
      guardian: {
        include: {
          contactPoints: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
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
  const normalizedEmail = email.toLowerCase().trim()

  return await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: normalizedEmail,
        },
      },
    },
    include: {
      contactPoints: true,
      programProfiles: true,
    },
  })
}

/**
 * Find guardian by email.
 *
 * @param email - Guardian email address
 * @returns Person record or null
 */
export async function findGuardianByEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim()

  return await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: normalizedEmail,
        },
      },
    },
    include: {
      contactPoints: true,
      dependentRelationships: {
        where: { isActive: true },
        include: {
          dependent: {
            include: {
              programProfiles: true,
            },
          },
        },
      },
    },
  })
}
