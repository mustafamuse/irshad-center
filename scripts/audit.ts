import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const students = await prisma.student.findMany({
    include: {
      Batch: {
        select: {
          id: true,
          name: true,
        },
      },
      Sibling: {
        select: {
          id: true,
        },
      },
    },
  })

  console.log('Student Subscription Audit:')
  console.log('===========================')

  students.forEach((student) => {
    console.log({
      studentId: student.id,
      studentName: student.name,
      email: student.email,
      status: student.status,
      subscriptionStatus: student.subscriptionStatus,
      stripeCustomerId: student.stripeCustomerId,
      stripeSubscriptionId: student.stripeSubscriptionId,
      monthlyRate: student.monthlyRate,
      batch: student.Batch?.name,
      siblingGroup: student.Sibling?.id,
      lastPaymentDate: student.lastPaymentDate,
      nextPaymentDue: student.nextPaymentDue,
    })
  })

  // Summary statistics
  const totalStudents = students.length
  const activeSubscriptions = students.filter(
    (s) => s.subscriptionStatus === 'active'
  ).length
  const studentsWithStripeCustomers = students.filter(
    (s) => s.stripeCustomerId
  ).length

  console.log('\nSummary:')
  console.log('========')
  console.log(`Total students: ${totalStudents}`)
  console.log(`Active subscriptions: ${activeSubscriptions}`)
  console.log(`Students with Stripe customers: ${studentsWithStripeCustomers}`)
}

main().finally(() => prisma.$disconnect())
