import { prisma } from '@/lib/db'

async function testDelete() {
  const personId = process.argv[2]

  if (!personId) {
    console.error('Usage: npx tsx scripts/test-delete-person.ts <personId>')
    process.exit(1)
  }

  console.log(`Testing delete for person: ${personId}\n`)

  try {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        contactPoints: true,
        teacher: {
          include: {
            programs: true,
          },
        },
        programProfiles: {
          include: {
            enrollments: true,
          },
        },
        guardianRelationships: true,
        billingAccounts: {
          include: {
            subscriptions: true,
          },
        },
      },
    })

    if (!person) {
      console.log('Person not found')
      return
    }

    console.log('Person found:', person.name)
    console.log('\nRelated records:')
    console.log('- Contact Points:', person.contactPoints.length)
    console.log('- Teacher:', person.teacher ? 'Yes' : 'No')
    if (person.teacher) {
      console.log('  - Programs:', person.teacher.programs.length)
      const assignments = await prisma.teacherAssignment.count({
        where: { teacherId: person.teacher.id },
      })
      console.log('  - Assignments:', assignments)
    }
    console.log('- Program Profiles:', person.programProfiles.length)
    person.programProfiles.forEach((p, i) => {
      console.log(
        `  [${i + 1}] ${p.program} - Enrollments: ${p.enrollments.length}`
      )
    })
    console.log(
      '- Guardian Relationships:',
      person.guardianRelationships.length
    )
    console.log('- Billing Accounts:', person.billingAccounts.length)
    person.billingAccounts.forEach((ba, i) => {
      console.log(`  [${i + 1}] Subscriptions: ${ba.subscriptions.length}`)
    })

    console.log('\nAttempting delete...')

    await prisma.$transaction(async (tx) => {
      const teachers = await tx.teacher.findMany({
        where: { personId },
        select: { id: true },
      })
      const teacherIds = teachers.map((t) => t.id)
      console.log('Teacher IDs:', teacherIds)

      const profiles = await tx.programProfile.findMany({
        where: { personId },
        select: { id: true },
      })
      const profileIds = profiles.map((p) => p.id)
      console.log('Profile IDs:', profileIds)

      console.log('\n1. Deleting teacher assignments...')
      const ta = await tx.teacherAssignment.deleteMany({
        where: {
          OR: [
            { teacherId: { in: teacherIds } },
            { programProfileId: { in: profileIds } },
          ],
        },
      })
      console.log('   Deleted:', ta.count)

      console.log('2. Deleting teacher programs...')
      const tp = await tx.teacherProgram.deleteMany({
        where: { teacherId: { in: teacherIds } },
      })
      console.log('   Deleted:', tp.count)

      console.log('3. Deleting teachers...')
      const t = await tx.teacher.deleteMany({
        where: { personId },
      })
      console.log('   Deleted:', t.count)

      console.log('4. Deleting enrollments...')
      const e = await tx.enrollment.deleteMany({
        where: { programProfileId: { in: profileIds } },
      })
      console.log('   Deleted:', e.count)

      console.log('5. Deleting program profiles...')
      const pp = await tx.programProfile.deleteMany({
        where: { personId },
      })
      console.log('   Deleted:', pp.count)

      console.log('6. Deleting guardian relationships...')
      const gr = await tx.guardianRelationship.deleteMany({
        where: {
          OR: [{ guardianId: personId }, { dependentId: personId }],
        },
      })
      console.log('   Deleted:', gr.count)

      console.log('7. Deleting billing assignments...')
      const ba = await tx.billingAssignment.deleteMany({
        where: { subscription: { billingAccount: { personId } } },
      })
      console.log('   Deleted:', ba.count)

      console.log('8. Deleting subscriptions...')
      const s = await tx.subscription.deleteMany({
        where: { billingAccount: { personId } },
      })
      console.log('   Deleted:', s.count)

      console.log('9. Deleting student payments...')
      const p = await tx.studentPayment.deleteMany({
        where: { ProgramProfile: { personId } },
      })
      console.log('   Deleted:', p.count)

      console.log('10. Deleting billing accounts...')
      const bac = await tx.billingAccount.deleteMany({
        where: { personId },
      })
      console.log('   Deleted:', bac.count)

      console.log('11. Deleting contact points...')
      const cp = await tx.contactPoint.deleteMany({
        where: { personId },
      })
      console.log('   Deleted:', cp.count)

      console.log('12. Deleting person...')
      await tx.person.delete({
        where: { id: personId },
      })
      console.log('   Deleted: 1')
    })

    console.log('\n✓ Successfully deleted person and all related records')
  } catch (error) {
    console.error('\n✗ Delete failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDelete()
