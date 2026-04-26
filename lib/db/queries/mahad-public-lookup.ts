import { EnrollmentStatus } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export function getLastNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : ''
}

export function getFirstNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[0]! : ''
}

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  REGISTERED: 'Registered',
  ENROLLED: 'Enrolled',
  ON_LEAVE: 'On leave',
  WITHDRAWN: 'Withdrawn',
  COMPLETED: 'Completed',
  SUSPENDED: 'Suspended',
}

export interface MahadPublicLookupSuccess {
  found: true
  /** Full name from Person record. Never forward to unauthenticated clients — the action layer intentionally strips this field. */
  studentName: string
  /** UTC date string YYYY-MM-DD of program profile creation */
  registeredAt: string
  programStatusLabel: string
}

export type MahadPublicLookupResult =
  | MahadPublicLookupSuccess
  | { found: false }

export interface MahadPublicLookupCandidate {
  status: EnrollmentStatus
  createdAt: Date
  person: { name: string }
}

export function pickMahadRegistrationMatch<
  T extends { person: { name: string } },
>(
  profiles: T[],
  normalizedFirstName: string,
  normalizedLastName: string
): T | null {
  const matches = profiles.filter((profile) => {
    const first = getFirstNameFromFullName(profile.person.name).toLowerCase()
    const last = getLastNameFromFullName(profile.person.name).toLowerCase()
    return first === normalizedFirstName && last === normalizedLastName
  })

  if (matches.length !== 1) {
    return null
  }

  return matches[0] ?? null
}

/**
 * Public self-check: match a Mahad program profile by legal first + last name
 * (first/last whitespace-delimited tokens of `Person.name`) and the last 4
 * digits of the stored 10-digit phone number. Requiring first name prevents
 * sibling collisions where families share a surname and phone number.
 */
export async function findMahadRegistrationByNameAndPhoneLast4(
  firstName: string,
  lastName: string,
  phoneLast4: string,
  client: DatabaseClient = prisma
): Promise<MahadPublicLookupResult> {
  const normFirst = firstName.trim().toLowerCase()
  const normLast = lastName.trim().toLowerCase()
  if (!normFirst || !normLast || !/^\d{4}$/.test(phoneLast4)) {
    return { found: false }
  }

  const profiles = await client.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      person: {
        phone: { endsWith: phoneLast4 },
      },
    },
    take: 10,
    select: {
      status: true,
      createdAt: true,
      person: {
        select: {
          name: true,
        },
      },
    },
  })

  // If take:10 was saturated we can't guarantee the right profile wasn't truncated — return not-found.
  if (profiles.length >= 10) return { found: false }

  const match = pickMahadRegistrationMatch(profiles, normFirst, normLast)

  if (!match) {
    return { found: false }
  }

  return {
    found: true,
    studentName: match.person.name.trim(),
    registeredAt: match.createdAt.toISOString().slice(0, 10),
    programStatusLabel: ENROLLMENT_STATUS_LABELS[match.status],
  }
}
