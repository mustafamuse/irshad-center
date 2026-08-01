import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import {
  normalizePhone,
  validateAndNormalizeEmail,
} from '@/lib/utils/contact-normalization'

export async function searchPeopleWithRoles(
  query: string,
  maxResults: number,
  client: DatabaseClient = prisma
) {
  const searchTerm = query.trim().toLowerCase()
  const normalizedPhone = normalizePhone(query.trim())

  return client.person.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          email: {
            contains: validateAndNormalizeEmail(query.trim()) ?? searchTerm,
            mode: 'insensitive',
          },
        },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
    relationLoadStrategy: 'join',
    include: {
      teacher: {
        include: {
          programs: {
            where: { isActive: true },
          },
        },
      },
      guardianRelationships: {
        where: { isActive: true },
        include: {
          dependent: {
            include: {
              programProfiles: {
                select: { program: true },
              },
            },
          },
        },
      },
      programProfiles: {
        where: {
          enrollments: {
            some: {
              status: { in: ['REGISTERED', 'ENROLLED'] },
              endDate: null,
            },
          },
        },
        include: {
          enrollments: {
            where: {
              status: { in: ['REGISTERED', 'ENROLLED'] },
              endDate: null,
            },
            select: { status: true },
            take: 1,
          },
        },
      },
    },
    take: maxResults,
    orderBy: { name: 'asc' },
  })
}
