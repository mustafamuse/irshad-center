import { prisma } from '@/lib/db'

async function findPersonRelationships() {
  const person = await prisma.person.findFirst({
    where: {
      name: {
        contains: 'Mustafa',
        mode: 'insensitive',
      },
    },
    include: {
      contactPoints: true,
      guardianRelationships: {
        include: {
          dependent: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
      dependentRelationships: {
        include: {
          guardian: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
      siblingRelationships1: {
        include: {
          person2: true,
        },
      },
      siblingRelationships2: {
        include: {
          person1: true,
        },
      },
      programProfiles: {
        include: {
          enrollments: {
            include: {
              batch: true,
            },
          },
          assignments: true,
        },
      },
      billingAccounts: {
        include: {
          subscriptions: {
            include: {
              assignments: {
                include: {
                  programProfile: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      teacher: {
        include: {
          programs: true,
        },
      },
    },
  })

  if (!person) {
    console.log('Person not found')
    return
  }

  console.log('=== PERSON ===')
  console.log(`ID: ${person.id}`)
  console.log(`Name: ${person.name}`)
  console.log(`DOB: ${person.dateOfBirth}`)
  console.log()

  console.log('=== CONTACT POINTS ===')
  person.contactPoints.forEach((cp) => {
    console.log(
      `- ${cp.type}: ${cp.value} ${cp.isPrimary ? '(PRIMARY)' : ''} ${cp.isActive ? '✓' : '✗'}`
    )
  })
  console.log()

  console.log('=== GUARDIAN RELATIONSHIPS (as Guardian) ===')
  person.guardianRelationships.forEach((rel) => {
    console.log(`- ${rel.role} to: ${rel.dependent.name} (${rel.dependent.id})`)
    rel.dependent.contactPoints.forEach((cp) => {
      console.log(`  Contact: ${cp.type}: ${cp.value}`)
    })
  })
  console.log()

  console.log('=== DEPENDENT RELATIONSHIPS (as Dependent) ===')
  person.dependentRelationships.forEach((rel) => {
    console.log(`- ${rel.role} from: ${rel.guardian.name} (${rel.guardian.id})`)
  })
  console.log()

  console.log('=== SIBLING RELATIONSHIPS ===')
  const siblings = [
    ...person.siblingRelationships1.map((r) => r.person2),
    ...person.siblingRelationships2.map((r) => r.person1),
  ]
  siblings.forEach((sibling) => {
    console.log(`- Sibling: ${sibling.name} (${sibling.id})`)
  })
  console.log()

  console.log('=== PROGRAM PROFILES ===')
  person.programProfiles.forEach((profile) => {
    console.log(`- Program: ${profile.program}`)
    console.log(`  Profile ID: ${profile.id}`)
    console.log(`  Status: ${profile.status}`)
    console.log(`  Monthly Rate: $${profile.monthlyRate / 100}`)
    if (profile.enrollments && profile.enrollments.length > 0) {
      console.log(`  Enrollments:`)
      profile.enrollments.forEach((enrollment) => {
        console.log(`    - Status: ${enrollment.status}`)
        console.log(`      Batch: ${enrollment.batch?.name || 'N/A'}`)
        console.log(`      Start Date: ${enrollment.startDate}`)
        console.log(`      End Date: ${enrollment.endDate || 'Active'}`)
      })
    }
    if (profile.assignments && profile.assignments.length > 0) {
      console.log(`  Assignments: ${profile.assignments.length}`)
    }
  })
  console.log()

  console.log('=== BILLING ACCOUNTS ===')
  person.billingAccounts.forEach((account) => {
    console.log(`- Account ID: ${account.id}`)
    console.log(`  Account Type: ${account.accountType}`)
    const stripeCustomerId =
      account.stripeCustomerIdMahad ||
      account.stripeCustomerIdDugsi ||
      account.stripeCustomerIdYouth ||
      account.stripeCustomerIdDonation
    console.log(`  Stripe Customer ID: ${stripeCustomerId || 'N/A'}`)
    if (account.subscriptions && account.subscriptions.length > 0) {
      console.log(`  Subscriptions:`)
      account.subscriptions.forEach((subscription) => {
        console.log(`    - ${subscription.stripeSubscriptionId}`)
        console.log(`      Status: ${subscription.status}`)
        console.log(`      Stripe Account: ${subscription.stripeAccountType}`)
        if (subscription.assignments && subscription.assignments.length > 0) {
          console.log(`      Billing Assignments:`)
          subscription.assignments.forEach((assignment) => {
            console.log(
              `        - ${assignment.programProfile.person.name}: $${assignment.amount / 100} ${assignment.isActive ? '✓' : '✗'}`
            )
          })
        }
      })
    }
  })
  console.log()

  console.log('=== TEACHER ROLE ===')
  if (person.teacher) {
    console.log(`- Teacher ID: ${person.teacher.id}`)
    const programs = person.teacher.programs.map((p) => p.program).join(', ')
    console.log(`  Programs: ${programs || 'None'}`)
    const activePrograms = person.teacher.programs.filter(
      (p) => p.isActive
    ).length
    console.log(`  Active Programs: ${activePrograms}`)
  } else {
    console.log('Not a teacher')
  }

  await prisma.$disconnect()
}

findPersonRelationships().catch(console.error)
