/**
 * Backfill lastPaymentDate for active subscriptions.
 *
 * Sets lastPaymentDate = now() for active subscriptions where it's currently null.
 * These are subscriptions that have been paying but the webhook never recorded the date.
 * The next real payment will overwrite with the actual timestamp.
 *
 * Usage:
 *   npx tsx scripts/backfill-last-payment-date.ts
 */

import { prisma } from '@/lib/db'

async function backfillLastPaymentDate() {
  const result = await prisma.subscription.updateMany({
    where: { status: 'active', lastPaymentDate: null },
    data: { lastPaymentDate: new Date() },
  })

  console.log(`Updated ${result.count} subscriptions with lastPaymentDate`)
}

backfillLastPaymentDate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
