import { linkDugsiSubscription } from '../app/admin/dugsi/actions'

async function testSubscriptionLinking() {
  // Get parameters from command line arguments or environment variables
  const parentEmail = process.argv[2] || process.env.DUGSI_TEST_EMAIL
  const subscriptionId =
    process.argv[3] || process.env.DUGSI_TEST_SUBSCRIPTION_ID

  if (!parentEmail || !subscriptionId) {
    console.error(
      'Usage: tsx scripts/test-subscription-link.ts <parentEmail> <subscriptionId>'
    )
    console.error(
      'Or set DUGSI_TEST_EMAIL and DUGSI_TEST_SUBSCRIPTION_ID environment variables'
    )
    process.exit(1)
  }

  console.log('Testing subscription linking...')
  console.log(`Parent Email: ${parentEmail}`)
  console.log(`Subscription ID: ${subscriptionId}\n`)

  const result = await linkDugsiSubscription({
    parentEmail,
    subscriptionId,
  })

  console.log('Link result:', result)
}

testSubscriptionLinking()
  .catch(console.error)
  .then(() => process.exit(0))
