/**
 * Fix Payment Method Captured
 *
 * Updates existing Dugsi billing accounts that have active subscriptions
 * but paymentMethodCaptured is false.
 *
 * Usage:
 *   npx tsx scripts/fix-payment-method-captured.ts
 */

import { prisma } from '@/lib/db'

async function fixPaymentMethodCaptured() {
  const accounts = await prisma.billingAccount.findMany({
    where: {
      accountType: 'DUGSI',
      stripeCustomerIdDugsi: { not: null },
      paymentMethodCaptured: false,
    },
    include: {
      subscriptions: {
        where: { status: 'active' },
      },
      person: true,
    },
  })

  console.log(`Found ${accounts.length} accounts to check`)

  let updated = 0
  for (const account of accounts) {
    if (account.subscriptions.length > 0) {
      const name = account.person?.name ?? account.id
      console.log(`Updating: ${name}`)
      await prisma.billingAccount.update({
        where: { id: account.id },
        data: {
          paymentMethodCaptured: true,
          paymentMethodCapturedAt: new Date(),
        },
      })
      updated++
    }
  }

  console.log(`Done! Updated ${updated} accounts.`)
}

fixPaymentMethodCaptured()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
