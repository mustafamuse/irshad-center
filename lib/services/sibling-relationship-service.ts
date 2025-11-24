/**
 * Sibling Relationship Service
 *
 * Centralized service for managing sibling relationships during registration.
 * Eliminates 42 lines of duplicate code between new registration and resume registration paths.
 */

import type { DatabaseClient } from '@/lib/db/types'
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('SiblingRelationshipService')

/**
 * Result of linking siblings to a person
 */
export interface LinkSiblingsResult {
  /** Number of sibling relationships successfully created */
  added: number

  /** Number of sibling relationships that failed */
  failed: number

  /** Details of failed sibling links */
  failures: Array<{
    siblingId: string
    error: string
  }>
}

/**
 * Sibling Relationship Service
 */
export class SiblingRelationshipService {
  /**
   * Link siblings to a person within a transaction
   *
   * This method replaces the duplicate sibling handling code in:
   * - PATH A (new registration): lines 352-411
   * - PATH D (resume registration): lines 188-230
   *
   * @param personId - The person to link siblings to
   * @param siblingIds - Array of sibling person IDs to link
   * @param tx - Database transaction client (REQUIRED for atomicity)
   * @returns Result with counts of successful and failed links
   *
   * @example
   * const result = await prisma.$transaction(async (tx) => {
   *   // ... create person/profile/enrollment ...
   *
   *   // Link siblings atomically
   *   return await SiblingRelationshipService.linkSiblings(
   *     person.id,
   *     siblingPersonIds,
   *     tx
   *   )
   * })
   *
   * if (result.failed > 0) {
   *   console.log(`Warning: ${result.failed} siblings failed to link`)
   * }
   */
  static async linkSiblings(
    personId: string,
    siblingIds: string[] | null,
    tx: DatabaseClient
  ): Promise<LinkSiblingsResult> {
    // If no siblings provided, return early
    if (!siblingIds || siblingIds.length === 0) {
      logger.info('No siblings to link', { personId })
      return {
        added: 0,
        failed: 0,
        failures: [],
      }
    }

    logger.info('Starting sibling linking process', {
      personId,
      siblingCount: siblingIds.length,
    })

    let siblingsAdded = 0
    let siblingsFailed = 0
    const failures: Array<{ siblingId: string; error: string }> = []

    // Process each sibling relationship
    for (const siblingId of siblingIds) {
      try {
        // Verify sibling exists
        const siblingPerson = await tx.person.findUnique({
          where: { id: siblingId },
        })

        if (!siblingPerson) {
          logger.warn('Sibling person not found, skipping', {
            personId,
            siblingId,
          })
          siblingsFailed++
          failures.push({
            siblingId,
            error: 'Person not found',
          })
          continue
        }

        // Sort IDs to ensure person1Id < person2Id (database CHECK constraint)
        const [p1, p2] = [personId, siblingId].sort()

        // Check if relationship already exists
        const existingRelationship = await tx.siblingRelationship.findFirst({
          where: {
            person1Id: p1,
            person2Id: p2,
          },
        })

        if (existingRelationship) {
          // Reactivate if inactive
          if (!existingRelationship.isActive) {
            await tx.siblingRelationship.update({
              where: { id: existingRelationship.id },
              data: {
                isActive: true,
                detectionMethod: 'MANUAL',
              },
            })
            siblingsAdded++
            logger.info('Reactivated existing sibling relationship', {
              personId,
              siblingId,
            })
            continue
          } else {
            // Already active, skip
            logger.info('Sibling relationship already exists and is active', {
              personId,
              siblingId,
            })
            continue
          }
        }

        // Create single sibling relationship (not bidirectional)
        // The relationship is bidirectional by nature: if A is sibling of B, then B is sibling of A
        // We enforce person1Id < person2Id via database CHECK constraint
        await tx.siblingRelationship.create({
          data: {
            person1Id: p1,
            person2Id: p2,
            detectionMethod: 'MANUAL',
            isActive: true,
          },
        })

        siblingsAdded++
        logger.info('Successfully linked sibling', { personId, siblingId })
      } catch (error) {
        siblingsFailed++
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        logger.error('Failed to link sibling', {
          err: error,
          personId,
          siblingId,
        })

        failures.push({
          siblingId,
          error: errorMessage,
        })
      }
    }

    logger.info('Sibling linking complete', {
      personId,
      totalAttempted: siblingIds.length,
      added: siblingsAdded,
      failed: siblingsFailed,
    })

    return {
      added: siblingsAdded,
      failed: siblingsFailed,
      failures,
    }
  }

  /**
   * Get all siblings for a person
   *
   * @param personId - Person to get siblings for
   * @param client - Database client
   * @returns Array of sibling persons with their profiles
   */
  static async getSiblings(personId: string, client: DatabaseClient) {
    logger.info('Fetching siblings', { personId })

    // Get relationships where this person is person1
    const relationshipsAsPerson1 = await client.siblingRelationship.findMany({
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
    logger.info('Unlinking siblings', { personId1, personId2 })

    // Delete both directions of the relationship
    await tx.siblingRelationship.deleteMany({
      where: {
        OR: [
          { person1Id: personId1, person2Id: personId2 },
          { person1Id: personId2, person2Id: personId1 },
        ],
      },
    })

    logger.info('Successfully unlinked siblings', { personId1, personId2 })
  }
}
