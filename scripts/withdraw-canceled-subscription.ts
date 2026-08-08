/**
 * Withdraw the students behind a subscription Stripe already canceled
 * (dry-run by default)
 *
 * When customer.subscription.deleted never arrives — or predates the cascade
 * that handles it — the subscription ends but its students stay REGISTERED and
 * their class enrollments stay active. They keep occupying roster spots and
 * appear on attendance sheets for a family that left.
 *
 * This replays what handleSubscriptionDeleted does: cascade enrollments and
 * profiles to WITHDRAWN, then unlink the subscription so its BillingAssignment
 * rows go inactive — in one transaction, in that order. Order matters: the
 * cascade reads still-active assignments, so unlinking first would make it
 * find nothing and silently withdraw nobody.
 *
 * Running only the cascade is not a partial fix, it is a different bug:
 * isActive on BillingAssignment is read throughout the billing query layer, so
 * a withdrawn family would keep showing up as an active billing assignment —
 * a state no other code path produces.
 *
 * Both steps are idempotent (the cascade skips already-WITHDRAWN profiles;
 * deactivation is guarded on isActive), so a second run is a no-op.
 *
 * The subscription's own status is NOT set here. The guard below requires it
 * to be canceled already, which is the reconciler's job — that keeps Stripe,
 * not this script, as the thing that decides who gets withdrawn.
 *
 * Usage:
 *   set -a && source .env.local && set +a && NODE_ENV=production bunx tsx \
 *     scripts/withdraw-canceled-subscription.ts --subscription=sub_xxx
 *   ... add --apply to write
 */

import { prisma } from '@/lib/db'
import { unlinkSubscription } from '@/lib/services/shared/billing-service'
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
      id: true,
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

  const subscriptionRowId = subscription.id

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

  // Same order as handleSubscriptionDeleted: the cascade reads still-active
  // assignments, so it MUST run before unlinkSubscription deactivates them.
  const { result, unlinked } = await prisma.$transaction(async (tx) => {
    const cascade = await handleSubscriptionCancellationEnrollments(
      stripeSubscriptionId,
      'Subscription canceled in Stripe; cascade replayed manually',
      tx
    )
    const count = await unlinkSubscription(subscriptionRowId, tx)
    return { result: cascade, unlinked: count }
  })

  console.log(`\nenrollments withdrawn        : ${result.withdrawn}`)
  console.log(`profiles withdrawn           : ${result.profilesWithdrawn}`)
  console.log(
    `class enrollments deactivated: ${result.classEnrollmentsDeactivated}`
  )
  console.log(`billing assignments unlinked : ${unlinked}`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
