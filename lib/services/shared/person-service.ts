import { prisma } from '@/lib/db'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('person-service')

export async function deletePerson(personId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const teachers = await tx.teacher.findMany({
      where: { personId },
      select: { id: true },
    })
    const teacherIds = teachers.map((t) => t.id)

    const profiles = await tx.programProfile.findMany({
      where: { personId },
      select: { id: true },
    })
    const profileIds = profiles.map((p) => p.id)

    await tx.dugsiClassTeacher.deleteMany({
      where: { teacherId: { in: teacherIds } },
    })

    await tx.teacherProgram.deleteMany({
      where: { teacherId: { in: teacherIds } },
    })

    await tx.teacher.deleteMany({ where: { personId } })

    await tx.enrollment.deleteMany({
      where: { programProfileId: { in: profileIds } },
    })

    await tx.programProfile.deleteMany({ where: { personId } })

    await tx.guardianRelationship.deleteMany({
      where: {
        OR: [{ guardianId: personId }, { dependentId: personId }],
      },
    })

    await tx.subscription.deleteMany({
      where: { billingAccount: { personId } },
    })

    await tx.billingAccount.deleteMany({ where: { personId } })

    await tx.person.delete({ where: { id: personId } })
  })

  logger.info({ personId }, 'Person and all related records deleted')
}
