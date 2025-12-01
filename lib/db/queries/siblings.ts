import type {
  Person,
  ProgramProfile,
  Enrollment,
  Program,
} from '@prisma/client'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export interface SiblingDetails {
  person: Person
  profiles: Array<
    ProgramProfile & {
      enrollments: Enrollment[]
    }
  >
  isActive: boolean
  relationshipId: string
  detectionMethod: string
  confidence: number | null
}

/**
 * Get all siblings for a person
 * @param client - Optional database client (for transaction support)
 */
export async function getPersonSiblings(
  personId: string,
  client: DatabaseClient = prisma
): Promise<SiblingDetails[]> {
  const relationships = await client.siblingRelationship.findMany({
    where: {
      OR: [{ person1Id: personId }, { person2Id: personId }],
      isActive: true,
    },
    include: {
      person1: {
        include: {
          programProfiles: {
            include: {
              enrollments: {
                where: {
                  status: {
                    in: ['REGISTERED', 'ENROLLED'],
                  },
                },
                orderBy: {
                  startDate: 'desc',
                },
              },
            },
          },
        },
      },
      person2: {
        include: {
          programProfiles: {
            include: {
              enrollments: {
                where: {
                  status: {
                    in: ['REGISTERED', 'ENROLLED'],
                  },
                },
                orderBy: {
                  startDate: 'desc',
                },
              },
            },
          },
        },
      },
    },
  })

  return relationships.map((rel) => {
    const sibling = rel.person1Id === personId ? rel.person2 : rel.person1
    const profiles =
      rel.person1Id === personId
        ? rel.person2.programProfiles
        : rel.person1.programProfiles

    return {
      person: sibling,
      profiles: profiles.map((profile) => ({
        ...profile,
        enrollments: profile.enrollments || [],
      })),
      isActive: rel.isActive,
      relationshipId: rel.id,
      detectionMethod: rel.detectionMethod,
      confidence: rel.confidence,
    }
  })
}

/**
 * Get full sibling details with programs and enrollment status
 * @param client - Optional database client (for transaction support)
 */
export async function getSiblingDetails(
  personId: string,
  client: DatabaseClient = prisma
): Promise<{
  person: Person
  siblings: SiblingDetails[]
  totalSiblings: number
  programsAcrossSiblings: Set<string>
}> {
  const person = await client.person.findUnique({
    where: { id: personId },
    include: {
      programProfiles: {
        include: {
          enrollments: true,
        },
      },
    },
  })

  if (!person) {
    throw new Error(`Person not found: ${personId}`)
  }

  const siblings = await getPersonSiblings(personId, client)
  const programsAcrossSiblings = new Set<string>()

  // Collect all programs from person's profiles
  person.programProfiles.forEach((profile) => {
    programsAcrossSiblings.add(profile.program)
  })

  // Collect all programs from siblings' profiles
  siblings.forEach((sibling) => {
    sibling.profiles.forEach((profile) => {
      programsAcrossSiblings.add(profile.program)
    })
  })

  return {
    person,
    siblings,
    totalSiblings: siblings.length,
    programsAcrossSiblings,
  }
}

/**
 * Get sibling groups organized by program
 * @param client - Optional database client (for transaction support)
 */
export async function getSiblingGroupsByProgram(
  program?: string,
  client: DatabaseClient = prisma
) {
  const relationships = await client.siblingRelationship.findMany({
    where: {
      isActive: true,
    },
    include: {
      person1: {
        include: {
          programProfiles: {
            ...(program
              ? { where: { program: program as unknown as Program } }
              : {}),
            include: {
              enrollments: {
                where: {
                  status: {
                    in: ['REGISTERED', 'ENROLLED'],
                  },
                },
              },
            },
          },
        },
      },
      person2: {
        include: {
          programProfiles: {
            ...(program
              ? { where: { program: program as unknown as Program } }
              : {}),
            include: {
              enrollments: {
                where: {
                  status: {
                    in: ['REGISTERED', 'ENROLLED'],
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  // Group relationships into sibling groups
  const groups = new Map<
    string,
    Array<{
      person: Person
      profiles: Array<ProgramProfile & { enrollments: Enrollment[] }>
    }>
  >()

  for (const rel of relationships) {
    const groupKey = [rel.person1Id, rel.person2Id].sort().join('_')

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }

    const group = groups.get(groupKey)!

    // Add person1 if not already in group
    if (!group.some((p) => p.person.id === rel.person1Id)) {
      group.push({
        person: rel.person1,
        profiles: rel.person1.programProfiles,
      })
    }

    // Add person2 if not already in group
    if (!group.some((p) => p.person.id === rel.person2Id)) {
      group.push({
        person: rel.person2,
        profiles: rel.person2.programProfiles,
      })
    }
  }

  return Array.from(groups.values())
}

/**
 * Find siblings eligible for discounts
 * Returns sibling groups where at least 2 siblings are enrolled in programs
 * @param client - Optional database client (for transaction support)
 */
export async function getDiscountEligibleSiblings(
  client: DatabaseClient = prisma
) {
  const groups = await getSiblingGroupsByProgram(undefined, client)

  return groups.filter((group) => {
    // Count siblings with active enrollments
    const siblingsWithEnrollments = group.filter((member) =>
      member.profiles.some((profile) =>
        profile.enrollments.some(
          (enrollment) =>
            enrollment.status === 'REGISTERED' ||
            enrollment.status === 'ENROLLED'
        )
      )
    )

    return siblingsWithEnrollments.length >= 2
  })
}

/**
 * Verify a sibling relationship (mark as verified by admin)
 * @param client - Optional database client (for transaction support)
 */
export async function verifySiblingRelationship(
  relationshipId: string,
  verifiedBy: string,
  notes?: string,
  client: DatabaseClient = prisma
) {
  return await client.siblingRelationship.update({
    where: { id: relationshipId },
    data: {
      verifiedBy,
      verifiedAt: new Date(),
      isActive: true,
      notes: notes || undefined,
    },
  })
}

/**
 * Remove a sibling relationship
 * @param client - Optional database client (for transaction support)
 */
export async function removeSiblingRelationship(
  relationshipId: string,
  client: DatabaseClient = prisma
) {
  return await client.siblingRelationship.update({
    where: { id: relationshipId },
    data: {
      isActive: false,
    },
  })
}

/**
 * Get sibling relationships by program profile
 * Returns siblings of the person who owns this profile
 * @param client - Optional database client (for transaction support)
 */
export async function getSiblingRelationshipsByProfile(
  profileId: string,
  client: DatabaseClient = prisma
) {
  const profile = await client.programProfile.findUnique({
    where: { id: profileId },
    select: { personId: true },
  })

  if (!profile) {
    throw new Error(`ProgramProfile not found: ${profileId}`)
  }

  return getPersonSiblings(profile.personId, client)
}

/**
 * Get siblings by family reference ID (Dugsi families)
 * @param client - Optional database client (for transaction support)
 */
export async function getSiblingsByFamilyId(
  familyId: string,
  client: DatabaseClient = prisma
) {
  // Get all profiles with this familyReferenceId
  const profiles = await client.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: 'DUGSI_PROGRAM',
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      enrollments: {
        where: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
    },
  })

  // Get person IDs
  const personIds = profiles.map((p) => p.personId)

  if (personIds.length === 0) {
    return []
  }

  // Get all sibling relationships involving these persons
  const relationships = await client.siblingRelationship.findMany({
    where: {
      OR: [
        { person1Id: { in: personIds }, isActive: true },
        { person2Id: { in: personIds }, isActive: true },
      ],
    },
    include: {
      person1: {
        include: {
          programProfiles: {
            where: {
              familyReferenceId: familyId,
              program: 'DUGSI_PROGRAM',
            },
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
          contactPoints: true,
        },
      },
      person2: {
        include: {
          programProfiles: {
            where: {
              familyReferenceId: familyId,
              program: 'DUGSI_PROGRAM',
            },
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
          contactPoints: true,
        },
      },
    },
  })

  // Map to sibling details
  const siblingsMap = new Map<string, SiblingDetails>()

  for (const rel of relationships) {
    // For each person in the family, get their sibling
    for (const personId of personIds) {
      let siblingPerson
      if (rel.person1Id === personId) {
        siblingPerson = rel.person2
      } else if (rel.person2Id === personId) {
        siblingPerson = rel.person1
      } else {
        continue
      }

      // Only include if sibling is also in the same family
      const siblingProfiles = siblingPerson.programProfiles.filter(
        (p) => p.familyReferenceId === familyId
      )

      if (siblingProfiles.length > 0 && !siblingsMap.has(siblingPerson.id)) {
        siblingsMap.set(siblingPerson.id, {
          person: siblingPerson,
          profiles: siblingProfiles.map((profile) => ({
            ...profile,
            enrollments: profile.enrollments || [],
          })),
          isActive: rel.isActive,
          relationshipId: rel.id,
          detectionMethod: rel.detectionMethod,
          confidence: rel.confidence,
        })
      }
    }
  }

  return Array.from(siblingsMap.values())
}

/**
 * Create a sibling relationship between two persons
 * @param person1Id - First person ID
 * @param person2Id - Second person ID
 * @param detectionMethod - How the relationship was detected ('manual', 'GUARDIAN_MATCH', etc.)
 * @param confidence - Confidence score (0-1) for automatic detection, null for manual
 * @param client - Database client (for transaction support)
 */
export async function createSiblingRelationship(
  person1Id: string,
  person2Id: string,
  detectionMethod: string = 'manual',
  confidence: number | null = null,
  client: DatabaseClient = prisma
) {
  // Ensure person1Id < person2Id for consistency
  const [p1, p2] = [person1Id, person2Id].sort()

  // Check if relationship already exists
  const existing = await client.siblingRelationship.findFirst({
    where: {
      person1Id: p1,
      person2Id: p2,
    },
  })

  if (existing) {
    // Reactivate if inactive
    if (!existing.isActive) {
      return client.siblingRelationship.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          detectionMethod,
          confidence,
        },
      })
    }
    return existing
  }

  try {
    return await client.siblingRelationship.create({
      data: {
        person1Id: p1,
        person2Id: p2,
        detectionMethod,
        confidence,
        isActive: true,
      },
    })
  } catch (error) {
    // Handle race condition: P2002 means another thread created the relationship
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Return the existing relationship instead of throwing
      const existingFromRace = await client.siblingRelationship.findFirst({
        where: {
          person1Id: p1,
          person2Id: p2,
        },
      })
      if (existingFromRace) {
        return existingFromRace
      }
    }
    throw error
  }
}
