/**
 * Withdraw the students behind a subscription Stripe already canceled
 * (dry-run by default)
 *
 * When customer.subscription.deleted never arrives — or predates the cascade
 * that handles it — the subscription ends but its students stay REGISTERED and
 * their class enrollments stay active. They keep occupying roster spots and
 * appear on attendance sheets for a family that left.
 *
 * This runs handleSubscriptionCancellationEnrollments, the exact cascade the
 * webhook would have run, so the end state is the one the system produces
 * normally rather than a hand-repaired approximation. That function is
 * transactional and idempotent (it skips already-WITHDRAWN profiles and guards
 * class deactivation on isActive), so a second run is a no-op.
 *
 * Deliberately NOT done here, matching the webhook: BillingAssignment rows are
 * left active. Leaving them is the normal post-cancellation state in this
 * system, and deviating would produce a shape no other code path creates.
 *
 * Guard: refuses to touch a subscription that is not already canceled in the
 * DB. Reconcile status first (scripts/reconcile-subscription-status.ts) so
 * Stripe is the thing deciding who gets withdrawn, never this script.
 *
 * Usage:
 *   set -a && source .env.local && set +a && NODE_ENV=production bunx tsx \
 *     scripts/withdraw-canceled-subscription.ts --subscription=sub_xxx
 *   ... add --apply to write
 */

import { prisma } from '@/lib/db'
import { handleSubscriptionCancellationEnrollments } from '@/lib/services/shared/enrollment-service'

import { runScript } from './lib/run-script'

function parseSubscriptionId(): string {
  const arg = process.argv.find((a) => a.startsWith('--subscription='))
  const id = arg?.slice('--subscription='.length)
  if (!id) {
    throw new Error(
      'Missing --subscription=<stripe subscription id>. This script withdraws ' +
        'real students; it will not guess which ones.'
    )
  }
  return id
}

async function main() {
  const apply = process.argv.includes('--apply')
  const stripeSubscriptionId = parseSubscriptionId()

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
    select: {
      status: true,
      amount: true,
      assignments: {
        where: { isActive: true },
        select: {
          programProfile: {
            select: {
              id: true,
              program: true,
              status: true,
              person: { select: { name: true } },
              dugsiClassEnrollment: { select: { isActive: true } },
            },
          },
        },
      },
    },
  })

  if (!subscription) {
    throw new Error(`No Subscription row for ${stripeSubscriptionId}`)
  }

  // Stripe decides who is canceled, not this script. Running against a live
  // subscription would withdraw a paying family's children.
  if (subscription.status !== 'canceled') {
    throw new Error(
      `Refusing to withdraw: ${stripeSubscriptionId} has status ` +
        `"${subscription.status}", not "canceled". Reconcile status against ` +
        `Stripe first (scripts/reconcile-subscription-status.ts).`
    )
  }

  const profiles = subscription.assignments
    .map((a) => a.programProfile)
    .filter((p) => p !== null)

  console.log(
    `\n${stripeSubscriptionId} — status ${subscription.status}, ` +
      `$${(subscription.amount / 100).toFixed(2)}/mo`
  )
  console.log(`${profiles.length} active assignment(s):\n`)
  for (const p of profiles) {
    console.log(
      `  ${p.person?.name ?? '(unnamed)'} [${p.program} ${p.status}] ` +
        `class enrollment active: ${p.dugsiClassEnrollment?.isActive ?? false}`
    )
  }

  if (!apply) {
    console.log(
      '\nDRY RUN — re-run with --apply to withdraw these students and ' +
        'deactivate their class enrollments.'
    )
    return
  }

  const result = await handleSubscriptionCancellationEnrollments(
    stripeSubscriptionId,
    'Subscription canceled in Stripe; cascade replayed manually'
  )

  console.log(`\nenrollments withdrawn        : ${result.withdrawn}`)
  console.log(`profiles withdrawn           : ${result.profilesWithdrawn}`)
  console.log(
    `class enrollments deactivated: ${result.classEnrollmentsDeactivated}`
  )
}

runScript(main, { cleanup: () => prisma.$disconnect() })
