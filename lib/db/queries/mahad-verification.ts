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
        orderBy: { createdAt: 'desc' as const },
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

export const DOB_CANDIDATE_CAP = 25

/**
 * Fetch Mahad profiles whose person matches the given DOB. Caller is
 * responsible for narrowing this small set to a single match by normalized
 * name comparison, and for logging when the cap truncates.
 *
 * Both stored and submitted DOBs are local-midnight instants from
 * `tryBuildDate` (`new Date(y, m-1, d)`), so each carries its own device's
 * UTC offset for that calendar date. Two instants meaning the same calendar
 * day can therefore differ by up to 26h (UTC-12 vs UTC+14). Matching a
 * symmetric ±26h window around the submitted instant covers every offset
 * pair without extracting a UTC day (which itself shifts for east-of-UTC
 * submitters). Overlap with a neighboring calendar day is disambiguated by
 * the caller's name filter and its exactly-one-match rule.
 */
export async function findMahadProfilesByDob(
  dateOfBirth: Date,
  client: DatabaseClient = prisma
): Promise<MahadVerificationCandidate[]> {
  const HOUR = 60 * 60 * 1000
  const profiles = await client.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      person: {
        dateOfBirth: {
          gte: new Date(dateOfBirth.getTime() - 26 * HOUR),
          lte: new Date(dateOfBirth.getTime() + 26 * HOUR),
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: DOB_CANDIDATE_CAP,
    select: VERIFICATION_SELECT,
  })
  return profiles.map(toCandidate)
}
