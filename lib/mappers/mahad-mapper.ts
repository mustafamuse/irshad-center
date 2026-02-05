import { Prisma } from '@prisma/client'

export const mahadEnrollmentInclude =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: {
          include: {
            contactPoints: true,
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
  const emailContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )
  return emailContact?.value ?? null
}

export function extractStudentPhone(
  profile: Pick<MahadEnrollmentFull['programProfile'], 'person'>
): string | null {
  const phoneContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )
  return phoneContact?.value ?? null
}
