import { EnrollmentStatus } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'

export function getLastNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : ''
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
  studentName: string
  /** ISO date string (UTC) of program profile creation */
  registeredAt: string
  programStatusLabel: string
  enrollmentStatusLabel: string | null
}

export type MahadPublicLookupResult =
  | MahadPublicLookupSuccess
  | { found: false }

/**
 * Public self-check: match Mahad program profile by legal last name (last token of
 * `Person.name`) and last 4 digits of the stored 10-digit phone number.
 */
export async function findMahadRegistrationByLastNameAndPhoneLast4(
  lastName: string,
  phoneLast4: string
): Promise<MahadPublicLookupResult> {
  const normLast = lastName.trim().toLowerCase()
  if (!normLast || !/^\d{4}$/.test(phoneLast4)) {
    return { found: false }
  }

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      person: {
        phone: { endsWith: phoneLast4 },
      },
    },
    include: {
      person: true,
      enrollments: {
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  })

  const matches = profiles.filter(
    (p) => getLastNameFromFullName(p.person.name).toLowerCase() === normLast
  )

  // When ambiguous (multiple people share the same last name + last 4 of phone)
  // we return `not_found` instead of revealing a potentially wrong identity.
  if (matches.length !== 1) {
    return { found: false }
  }

  const match = matches[0]!
  const enrollment = match.enrollments[0]
  const programStatusLabel =
    ENROLLMENT_STATUS_LABELS[match.status] ?? match.status
  const enrollmentStatusLabel = enrollment
    ? (ENROLLMENT_STATUS_LABELS[enrollment.status] ?? enrollment.status)
    : null

  return {
    found: true,
    studentName: match.person.name.trim(),
    registeredAt: match.createdAt.toISOString(),
    programStatusLabel,
    enrollmentStatusLabel,
  }
}
