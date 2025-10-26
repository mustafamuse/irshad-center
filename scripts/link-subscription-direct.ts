import { PrismaClient } from '@prisma/client'

import { getDugsiStripeClient } from '../lib/stripe-dugsi'

const prisma = new PrismaClient()

async function linkSubscriptionDirectly() {
  // Get parameters from command line arguments or environment variables
  const parentEmail = process.argv[2] || process.env.DUGSI_TEST_EMAIL
  const subscriptionId =
    process.argv[3] || process.env.DUGSI_TEST_SUBSCRIPTION_ID

  if (!parentEmail || !subscriptionId) {
    console.error(
      'Usage: tsx scripts/link-subscription-direct.ts <parentEmail> <subscriptionId>'
    )
    console.error(
      'Or set DUGSI_TEST_EMAIL and DUGSI_TEST_SUBSCRIPTION_ID environment variables'
    )
    process.exit(1)
  }

  console.log('Linking subscription directly...')
  console.log(`Parent Email: ${parentEmail}`)
  console.log(`Subscription ID: ${subscriptionId}\n`)

  try {
    // Validate the subscription exists in Stripe
    console.log('Initializing Dugsi Stripe client...')
    const dugsiStripe = getDugsiStripeClient()

    console.log('Fetching subscription from Stripe...')
    const subscription =
      await dugsiStripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      console.log('Subscription not found in Stripe')
      return
    }

    console.log('Subscription found:', {
      id: subscription.id,
      status: subscription.status,
      customer: subscription.customer,
    })

    // Update all children of this parent with the subscription ID
    console.log(`\nUpdating students with parent email: ${parentEmail}`)
    const updateResult = await prisma.student.updateMany({
      where: {
        parentEmail,
        program: 'DUGSI_PROGRAM',
      },
      data: {
        stripeSubscriptionIdDugsi: subscriptionId,
        subscriptionStatus: subscription.status,
        stripeAccountType: 'DUGSI',
        stripeCustomerIdDugsi:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
      },
    })

    console.log(
      `\n✅ Successfully linked subscription to ${updateResult.count} students`
    )

    // Verify the update
    const updatedStudents = await prisma.student.findMany({
      where: {
        parentEmail,
        program: 'DUGSI_PROGRAM',
      },
      select: {
        name: true,
        stripeSubscriptionIdDugsi: true,
        subscriptionStatus: true,
        stripeCustomerIdDugsi: true,
      },
    })

    console.log('\nUpdated students:')
    updatedStudents.forEach((s) => {
      console.log(`- ${s.name}`)
      console.log(`  Subscription: ${s.stripeSubscriptionIdDugsi}`)
      console.log(`  Status: ${s.subscriptionStatus}`)
      console.log(`  Customer: ${s.stripeCustomerIdDugsi}`)
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

linkSubscriptionDirectly()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
