import { prisma } from '@/lib/db'
import type { Person, ProgramProfile, Enrollment } from '@prisma/client'

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
 */
export async function getPersonSiblings(personId: string): Promise<SiblingDetails[]> {
  const relationships = await prisma.siblingRelationship.findMany({
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
    const sibling =
      rel.person1Id === personId ? rel.person2 : rel.person1
    const profiles = rel.person1Id === personId
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
 */
export async function getSiblingDetails(
  personId: string
): Promise<{
  person: Person
  siblings: SiblingDetails[]
  totalSiblings: number
  programsAcrossSiblings: Set<string>
}> {
  const person = await prisma.person.findUnique({
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

  const siblings = await getPersonSiblings(personId)
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
 */
export async function getSiblingGroupsByProgram(program?: string) {
  const relationships = await prisma.siblingRelationship.findMany({
    where: {
      isActive: true,
    },
    include: {
      person1: {
        include: {
          programProfiles: {
            ...(program ? { where: { program: program as any } } : {}),
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
            ...(program ? { where: { program: program as any } } : {}),
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
  const groups = new Map<string, Array<{ person: Person; profiles: Array<ProgramProfile & { enrollments: Enrollment[] }> }>>()

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
 */
export async function getDiscountEligibleSiblings() {
  const groups = await getSiblingGroupsByProgram()

  return groups.filter((group) => {
    // Count siblings with active enrollments
    const siblingsWithEnrollments = group.filter((member) =>
      member.profiles.some((profile) =>
        profile.enrollments.some(
          (enrollment) =>
            enrollment.status === 'REGISTERED' || enrollment.status === 'ENROLLED'
        )
      )
    )

    return siblingsWithEnrollments.length >= 2
  })
}

/**
 * Verify a sibling relationship (mark as verified by admin)
 */
export async function verifySiblingRelationship(
  relationshipId: string,
  verifiedBy: string,
  notes?: string
) {
  return await prisma.siblingRelationship.update({
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
 */
export async function removeSiblingRelationship(relationshipId: string) {
  return await prisma.siblingRelationship.update({
    where: { id: relationshipId },
    data: {
      isActive: false,
    },
  })
}

