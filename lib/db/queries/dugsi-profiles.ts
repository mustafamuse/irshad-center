/**
 * Dugsi Profile Query Functions
 *
 * Queries for resolving and verifying Dugsi billing profile assignments.
 * Used by the webhook service for authoritative profile ID derivation.
 */

import { EnrollmentStatus, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

const BILLABLE_DUGSI_STATUSES = [
  EnrollmentStatus.REGISTERED,
  EnrollmentStatus.ENROLLED,
]

/**
 * Find a guardian by normalized email with all their billable Dugsi children.
 * Used by the Path 4 email fallback when a subscription has no metadata.
 */
export async function findGuardianWithBillableDugsiChildren(
  normalizedEmail: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: { email: normalizedEmail },
    include: {
      guardianRelationships: {
        where: { isActive: true },
        include: {
          dependent: {
            include: {
              programProfiles: {
                where: {
                  program: Program.DUGSI_PROGRAM,
                  status: { in: BILLABLE_DUGSI_STATUSES },
                },
                select: { id: true, familyReferenceId: true },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * Verify that profile IDs from Stripe metadata are valid:
 * they must exist, be DUGSI_PROGRAM, have a billable status,
 * and belong to a dependent of the guardian.
 *
 * Returns only the IDs that pass all checks.
 */
export async function verifyDugsiProfileIdsForGuardian(
  guardianPersonId: string,
  profileIds: string[],
  client: DatabaseClient = prisma
) {
  const valid = await client.programProfile.findMany({
    where: {
      id: { in: profileIds },
      program: Program.DUGSI_PROGRAM,
      status: { in: BILLABLE_DUGSI_STATUSES },
      person: {
        dependentRelationships: {
          some: { guardianId: guardianPersonId, isActive: true },
        },
      },
    },
    select: { id: true },
  })
  return valid.map((p) => p.id)
}

/**
 * Derive all billable Dugsi profile IDs for a guardian's active dependents.
 * Used as a fallback when metadata hints are absent or fail verification.
 * Deduplicates by profile ID (a child can appear via multiple guardian roles).
 */
export async function findBillableDugsiProfileIdsForGuardian(
  guardianPersonId: string,
  client: DatabaseClient = prisma
) {
  const guardian = await client.person.findFirst({
    where: { id: guardianPersonId },
    include: {
      guardianRelationships: {
        where: { isActive: true },
        include: {
          dependent: {
            include: {
              programProfiles: {
                where: {
                  program: Program.DUGSI_PROGRAM,
                  status: { in: BILLABLE_DUGSI_STATUSES },
                },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  })

  if (!guardian) return []

  const raw = guardian.guardianRelationships.flatMap(
    (rel) => rel.dependent.programProfiles
  )
  return Array.from(new Set(raw.map((p) => p.id)))
}
