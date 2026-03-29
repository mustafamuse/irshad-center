import { Prisma } from '@prisma/client'

import {
  extractPrimaryEmail,
  extractPrimaryPhone,
} from '@/lib/db/query-builders'

export const mahadEnrollmentInclude =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: {
          include: {
            contactPoints: { where: { isActive: true } },
          },
        },
        assignments: {
          where: { isActive: true },
          include: {
            subscription: true,
          },
          take: 1,
        },
      },
    },
    batch: true,
  })

export type MahadEnrollmentFull = Prisma.EnrollmentGetPayload<{
  include: typeof mahadEnrollmentInclude
}>

export function extractStudentEmail(
  profile: Pick<MahadEnrollmentFull['programProfile'], 'person'>
): string | null {
  return extractPrimaryEmail(profile.person.contactPoints)
}

export function extractStudentPhone(
  profile: Pick<MahadEnrollmentFull['programProfile'], 'person'>
): string | null {
  return extractPrimaryPhone(profile.person.contactPoints)
}
