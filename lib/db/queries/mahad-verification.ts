import { EnrollmentStatus, SubscriptionStatus } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

/**
 * Internal candidate row used by the verification service to compose a public
 * `LookupResult`. Holds enough state to derive friendly status + greeting,
 * but never crosses the action/UI boundary directly — the service strips
 * `fullName` before returning anything to a client.
 */
export interface MahadVerificationCandidate {
  profileId: string
  fullName: string
  registeredAt: Date
  enrollmentStatus: EnrollmentStatus
  hasStripeCustomer: boolean
  subscriptionStatus: SubscriptionStatus | null
}

const VERIFICATION_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  person: {
    select: {
      name: true,
      billingAccounts: {
        where: { accountType: 'MAHAD' as const },
        select: { stripeCustomerIdMahad: true },
        take: 1,
      },
    },
  },
  assignments: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      subscription: { select: { status: true } },
    },
  },
} as const

type RawCandidate = {
  id: string
  createdAt: Date
  status: EnrollmentStatus
  person: {
    name: string
    billingAccounts: Array<{ stripeCustomerIdMahad: string | null }>
  }
  assignments: Array<{
    subscription: { status: SubscriptionStatus } | null
  }>
}

function toCandidate(raw: RawCandidate): MahadVerificationCandidate {
  return {
    profileId: raw.id,
    fullName: raw.person.name,
    registeredAt: raw.createdAt,
    enrollmentStatus: raw.status,
    hasStripeCustomer: !!raw.person.billingAccounts[0]?.stripeCustomerIdMahad,
    subscriptionStatus: raw.assignments[0]?.subscription?.status ?? null,
  }
}

export async function findMahadProfileById(
  profileId: string,
  client: DatabaseClient = prisma
): Promise<MahadVerificationCandidate | null> {
  if (!profileId) return null
  const profile = await client.programProfile.findFirst({
    where: { id: profileId, program: MAHAD_PROGRAM },
    select: VERIFICATION_SELECT,
  })
  return profile ? toCandidate(profile) : null
}

export async function findMahadProfileByEmail(
  normalizedEmail: string,
  client: DatabaseClient = prisma
): Promise<MahadVerificationCandidate | null> {
  if (!normalizedEmail) return null
  const profile = await client.programProfile.findFirst({
    where: {
      program: MAHAD_PROGRAM,
      person: { email: normalizedEmail },
    },
    select: VERIFICATION_SELECT,
  })
  return profile ? toCandidate(profile) : null
}

/**
 * Fetch Mahad profiles whose person matches the given DOB. Caller is
 * responsible for narrowing this small set to a single match by normalized
 * name comparison. Cap is generous enough to absorb large families sharing
 * a DOB (twins, transcription overlap) while keeping response time bounded.
 */
export async function findMahadProfilesByDob(
  dateOfBirth: Date,
  client: DatabaseClient = prisma
): Promise<MahadVerificationCandidate[]> {
  const profiles = await client.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      person: { dateOfBirth },
    },
    take: 10,
    select: VERIFICATION_SELECT,
  })
  return profiles.map(toCandidate)
}
