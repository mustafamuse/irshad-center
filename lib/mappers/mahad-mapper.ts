import { Prisma } from '@prisma/client'

export const mahadEnrollmentInclude =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: true,
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
