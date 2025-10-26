import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDugsiData() {
  console.log('Checking Dugsi data in database...\n')

  // Check for students with Stripe customer IDs
  const studentsWithStripe = await prisma.student.findMany({
    where: {
      program: 'DUGSI_PROGRAM',
      stripeCustomerIdDugsi: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      parentEmail: true,
      stripeCustomerIdDugsi: true,
      stripeSubscriptionIdDugsi: true,
      subscriptionStatus: true,
      paymentMethodCaptured: true,
      familyReferenceId: true,
    },
  })

  console.log(
    `Found ${studentsWithStripe.length} Dugsi students with Stripe customer IDs:`
  )
  studentsWithStripe.forEach((student) => {
    console.log(`
- Name: ${student.name}
  Email: ${student.parentEmail}
  Customer ID: ${student.stripeCustomerIdDugsi}
  Subscription ID: ${student.stripeSubscriptionIdDugsi}
  Status: ${student.subscriptionStatus}
  Payment Captured: ${student.paymentMethodCaptured}
  Family Ref: ${student.familyReferenceId}
    `)
  })

  // Check for all Dugsi students
  const allDugsiStudents = await prisma.student.count({
    where: {
      program: 'DUGSI_PROGRAM',
    },
  })

  console.log(`\nTotal Dugsi students in database: ${allDugsiStudents}`)

  // Check for families (unique family references)
  const families = await prisma.student.findMany({
    where: {
      program: 'DUGSI_PROGRAM',
      familyReferenceId: {
        not: null,
      },
    },
    select: {
      familyReferenceId: true,
      parentEmail: true,
    },
    distinct: ['familyReferenceId'],
  })

  console.log(`\nTotal families with reference IDs: ${families.length}`)

  // Check specific Stripe customer IDs if provided via environment
  const stripeCustomerIds =
    process.env.DUGSI_CHECK_CUSTOMER_IDS?.split(',') || []

  for (const customerId of stripeCustomerIds) {
    const student = await prisma.student.findFirst({
      where: {
        stripeCustomerIdDugsi: customerId,
      },
    })

    if (student) {
      console.log(
        `\n✅ Found student with Stripe customer ${customerId}: ${student.name}`
      )
    } else {
      console.log(`\n❌ No student found with Stripe customer ${customerId}`)
    }
  }

  // Check specific subscription IDs if provided via environment
  const subscriptionIds =
    process.env.DUGSI_CHECK_SUBSCRIPTION_IDS?.split(',') || []

  for (const subId of subscriptionIds) {
    const students = await prisma.student.findMany({
      where: {
        stripeSubscriptionIdDugsi: subId,
      },
    })

    if (students.length > 0) {
      console.log(
        `\n✅ Found ${students.length} students with subscription ${subId}`
      )
      students.forEach((s) => console.log(`   - ${s.name}`))
    } else {
      console.log(`\n❌ No students found with subscription ${subId}`)
    }
  }
}

checkDugsiData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
