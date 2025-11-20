import { prisma } from '@/lib/db'
import type { Person } from '@prisma/client'

export type DetectionMethod = 'MANUAL' | 'GUARDIAN_MATCH' | 'NAME_MATCH' | 'CONTACT_MATCH'

export interface PotentialSibling {
  person: Person
  method: DetectionMethod
  confidence: number
  reasons: string[]
}

/**
 * Detect potential siblings for a person using multiple methods
 */
export async function detectPotentialSiblings(
  personId: string
): Promise<PotentialSibling[]> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      contactPoints: true,
      guardianRelationships: {
        include: {
          guardian: true,
        },
      },
      dependentRelationships: {
        include: {
          dependent: true,
        },
      },
    },
  })

  if (!person) {
    throw new Error(`Person not found: ${personId}`)
  }

  const potentialSiblings: PotentialSibling[] = []

  // Method 1: Guardian Match (for children)
  // Find other dependents of the same guardians
  if (person.guardianRelationships.length > 0) {
    const guardianIds = person.guardianRelationships
      .filter((rel) => rel.isActive)
      .map((rel) => rel.guardianId)

    if (guardianIds.length > 0) {
      const siblingsViaGuardians = await prisma.guardianRelationship.findMany({
        where: {
          guardianId: { in: guardianIds },
          dependentId: { not: personId },
          isActive: true,
        },
        include: {
          dependent: true,
          guardian: true,
        },
      })

      for (const rel of siblingsViaGuardians) {
        // Check if relationship already exists
        const existing = await prisma.siblingRelationship.findFirst({
          where: {
            OR: [
              { person1Id: personId, person2Id: rel.dependentId },
              { person1Id: rel.dependentId, person2Id: personId },
            ],
          },
        })

        if (!existing) {
          potentialSiblings.push({
            person: rel.dependent,
            method: 'GUARDIAN_MATCH',
            confidence: 0.9,
            reasons: [`Shared guardian: ${rel.guardian.name}`],
          })
        }
      }
    }
  }

  // Method 2: Name Match (for adults)
  // Match by last name and similar age
  const nameParts = person.name.trim().split(/\s+/)
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1]

    const nameMatches = await prisma.person.findMany({
      where: {
        id: { not: personId },
        name: {
          contains: lastName,
          mode: 'insensitive',
        },
      },
    })

    for (const match of nameMatches) {
      // Check if relationship already exists
      const existing = await prisma.siblingRelationship.findFirst({
        where: {
          OR: [
            { person1Id: personId, person2Id: match.id },
            { person1Id: match.id, person2Id: personId },
          ],
        },
      })

      if (!existing) {
        let confidence = 0.5
        const reasons: string[] = [`Shared last name: ${lastName}`]

        // Increase confidence if ages are similar
        if (person.dateOfBirth && match.dateOfBirth) {
          const ageDiff = Math.abs(
            person.dateOfBirth.getTime() - match.dateOfBirth.getTime()
          )
          const yearsDiff = ageDiff / (1000 * 60 * 60 * 24 * 365)
          if (yearsDiff < 5) {
            confidence = 0.7
            reasons.push(`Similar age (${Math.round(yearsDiff)} years apart)`)
          }
        }

        potentialSiblings.push({
          person: match,
          method: 'NAME_MATCH',
          confidence,
          reasons,
        })
      }
    }
  }

  // Method 3: Contact Match
  // Match by shared contact points (phone, email)
  if (person.contactPoints.length > 0) {
    const contactValues = person.contactPoints.map((cp) => cp.value.toLowerCase())

    const contactMatches = await prisma.contactPoint.findMany({
      where: {
        value: {
          in: contactValues,
          mode: 'insensitive',
        },
        personId: { not: personId },
      },
      include: {
        person: true,
      },
    })

    for (const match of contactMatches) {
      // Check if relationship already exists
      const existing = await prisma.siblingRelationship.findFirst({
        where: {
          OR: [
            { person1Id: personId, person2Id: match.personId },
            { person1Id: match.personId, person2Id: personId },
          ],
        },
      })

      if (!existing) {
        // Check if this person is already in potentialSiblings
        const alreadyAdded = potentialSiblings.some(
          (ps) => ps.person.id === match.personId
        )

        if (!alreadyAdded) {
          potentialSiblings.push({
            person: match.person,
            method: 'CONTACT_MATCH',
            confidence: 0.8,
            reasons: [`Shared ${match.type.toLowerCase()}: ${match.value}`],
          })
        }
      }
    }
  }

  // Sort by confidence (highest first)
  return potentialSiblings.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Calculate confidence score for a sibling relationship
 */
export function calculateConfidenceScore(
  method: DetectionMethod,
  matchingCriteria: {
    sharedGuardians?: number
    nameMatch?: boolean
    ageSimilarity?: number
    sharedContacts?: number
  }
): number {
  let score = 0

  switch (method) {
    case 'GUARDIAN_MATCH':
      score = 0.9
      if (matchingCriteria.sharedGuardians && matchingCriteria.sharedGuardians > 1) {
        score = 0.95
      }
      break
    case 'CONTACT_MATCH':
      score = 0.7 + (matchingCriteria.sharedContacts || 0) * 0.1
      score = Math.min(score, 0.95)
      break
    case 'NAME_MATCH':
      score = 0.5
      if (matchingCriteria.nameMatch) {
        score = 0.6
      }
      if (matchingCriteria.ageSimilarity && matchingCriteria.ageSimilarity < 5) {
        score += 0.2
      }
      score = Math.min(score, 0.9)
      break
    case 'MANUAL':
      score = 1.0
      break
  }

  return Math.min(Math.max(score, 0), 1)
}

/**
 * Create a sibling relationship
 */
export async function createSiblingRelationship(
  person1Id: string,
  person2Id: string,
  method: DetectionMethod,
  options?: {
    confidence?: number
    verifiedBy?: string
    notes?: string
  }
) {
  if (person1Id === person2Id) {
    throw new Error('Cannot create sibling relationship with self')
  }

  // Ensure person1Id < person2Id for consistency (or use a different ordering)
  const [p1, p2] = [person1Id, person2Id].sort()

  return await prisma.siblingRelationship.create({
    data: {
      person1Id: p1,
      person2Id: p2,
      detectionMethod: method,
      confidence: options?.confidence ?? (method === 'MANUAL' ? 1.0 : null),
      verifiedBy: options?.verifiedBy,
      verifiedAt: options?.verifiedBy ? new Date() : null,
      notes: options?.notes,
      isActive: true,
    },
  })
}

