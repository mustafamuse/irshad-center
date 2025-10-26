import { linkDugsiSubscription } from '../app/admin/dugsi/actions'

async function testSubscriptionLinking() {
  console.log('Testing subscription linking...\n')

  // Try to link the second subscription to the student with email zxczc@gmai.coma
  const result = await linkDugsiSubscription({
    parentEmail: 'zxczc@gmai.coma',
    subscriptionId: 'sub_1SMFXBEPoTboEBNA3HdYjXEa',
  })

  console.log('Link result:', result)
}

testSubscriptionLinking()
  .catch(console.error)
  .then(() => process.exit(0))
