import { prisma } from '@/lib/db'
import { deletePersonCascade } from '@/lib/db/queries/person'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('person-service')

export async function deletePerson(personId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deletePersonCascade(personId, tx)
  })

  logger.info({ personId }, 'Person and all related records deleted')
}
