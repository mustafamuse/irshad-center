/**
 * Sibling Relationship Service
 *
 * Centralized service for managing sibling relationships during registration.
 * Eliminates 42 lines of duplicate code between new registration and resume registration paths.
 */

import type { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('sibling-relationship')

/**
 * Sibling Relationship Service
 */
export class SiblingRelationshipService {
  /**
   * Get all siblings for a person
   *
   * @param personId - Person to get siblings for
   * @param client - Database client
   * @returns Array of sibling persons with their profiles
   */
  static async getSiblings(personId: string, client: DatabaseClient) {
    logger.info({ personId }, 'Fetching siblings')

    // Get relationships where this person is person1
    const relationshipsAsPerson1 = await client.siblingRelationship.findMany({
      relationLoadStrategy: 'join',
      where: { person1Id: personId, isActive: true },
      include: {
        person2: {
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
    })

    // Get relationships where this person is person2
    const relationshipsAsPerson2 = await client.siblingRelationship.findMany({
      relationLoadStrategy: 'join',
      where: { person2Id: personId, isActive: true },
      include: {
        person1: {
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
    })

    // Combine both and extract the sibling persons
    const siblings = [
      ...relationshipsAsPerson1.map((rel) => rel.person2),
      ...relationshipsAsPerson2.map((rel) => rel.person1),
    ]

    return siblings
  }

  /**
   * Check if two people are already siblings
   *
   * @param personId2 - Second person ID
   * @param client - Database client
   * @returns true if they are already linked as siblings
   */
  static async areSiblings(
    personId1: string,
    personId2: string,
    client: DatabaseClient
  ): Promise<boolean> {
    // Sort IDs to ensure person1Id < person2Id (database CHECK constraint)
    // This allows us to check only one direction instead of using OR clause
    const [p1, p2] = [personId1, personId2].sort()

    const relationship = await client.siblingRelationship.findFirst({
      where: {
        person1Id: p1,
        person2Id: p2,
        isActive: true,
      },
    })

    return !!relationship
  }

  /**
   * Remove a sibling relationship (bidirectional)
   *
   * @param personId2 - Second person ID
   * @param tx - Database transaction client
   */
  static async unlinkSiblings(
    personId1: string,
    personId2: string,
    tx: DatabaseClient
  ): Promise<void> {
    logger.info({ personId1, personId2 }, 'Unlinking siblings')

    // Delete both directions of the relationship
    await tx.siblingRelationship.deleteMany({
      where: {
        OR: [
          { person1Id: personId1, person2Id: personId2 },
          { person1Id: personId2, person2Id: personId1 },
        ],
      },
    })

    logger.info({ personId1, personId2 }, 'Successfully unlinked siblings')
  }
}
