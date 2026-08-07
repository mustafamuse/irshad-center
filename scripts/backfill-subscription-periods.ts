/**
 * Backfill subscription period dates lost to the Stripe field migration
 * (dry-run by default)
 *
 * API version 2025-08-27.basil moved current_period_start/end off the
 * subscription and onto each subscription item. extractPeriodDates only read
 * the old top-level location, so every webhook delivered in the new shape wrote
 * nulls. Both shapes are live on our endpoints right now — a sample of recent
 * events showed roughly a 50/50 split — which is why most rows have no period
 * data at all.
 *
 * The read path was fixed to accept both shapes, so new events are recorded
 * correctly, but existing rows stay null until something rewrites them. This
 * re-reads each affected subscription straight from Stripe and fills them in.
 *
 * paidUntil follows the same settlement rule the application uses: an existing
 * non-null value is never overwritten, and a new one is inferred only when
 * Stripe reports the subscription active AND collection is not paused. Stripe
 * leaves status 'active' on a paused subscription, so status alone would stamp
 * "paid through" on invoices being marked uncollectible.
 *
 * Stripe key mode is selected by NODE_ENV (lib/keys/stripe.ts), which is unset
 * under `bunx tsx`. Without NODE_ENV=production this script would authenticate
 * against the test accounts while reading production rows, and every live
 * sub_... would come back 404 — indistinguishable from "the subscription is
 * gone" unless the error is printed. Hence both the guard and the loud catch.
 *
 * Usage:
 *   set -a && source .env.local && set +a && \
 *     NODE_ENV=production bunx tsx scripts/backfill-subscription-periods.ts
 *   ... add --apply to write
 */

import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { stripeServerClient } from '@/lib/stripe-mahad'
import { resolveInitialPaidUntil } from '@/lib/utils/subscription-status'
import { extractPeriodDates } from '@/lib/utils/type-guards'

import { runScript } from './lib/run-script'

function assertKeyModeMatchesData() {
  if (process.env.NODE_ENV === 'production') return
  throw new Error(
    'Refusing to run: NODE_ENV is not "production", so lib/keys/stripe selects ' +
      'TEST keys while DATABASE_URL points at the production database. Live ' +
      'subscription ids do not exist in the test accounts, so every lookup ' +
      'would 404. Re-run with NODE_ENV=production.'
  )
}

async function main() {
  const apply = process.argv.includes('--apply')
  assertKeyModeMatchesData()

  const rows = await prisma.subscription.findMany({
    where: {
      status: { notIn: ['canceled', 'incomplete_expired'] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodStart: null }],
    },
    select: {
      id: true,
      stripeSubscriptionId: true,
      stripeAccountType: true,
      status: true,
      paidUntil: true,
    },
  })

  console.log(`\n${rows.length} live subscription(s) missing period dates\n`)
  if (rows.length === 0) return

  let filled = 0
  let stillEmpty = 0
  let missingInStripe = 0
  let staleStatus = 0
  const paidUntilSet: string[] = []

  for (const row of rows) {
    // Per-program client: a Mahad subscription id does not exist in the Dugsi
    // account and vice versa, so the wrong client returns a 404, not a match.
    const stripe =
      row.stripeAccountType === 'DUGSI'
        ? getDugsiStripeClient()
        : stripeServerClient

    let subscription: Stripe.Subscription
    try {
      subscription = await stripe.subscriptions.retrieve(
        row.stripeSubscriptionId
      )
    } catch (error) {
      // Print what Stripe actually said. A uniform failure across every row is
      // an auth or key-mode problem, not 39 independently missing subscriptions
      // — collapsing both into one message hides the difference.
      missingInStripe++
      const detail =
        error instanceof Stripe.errors.StripeError
          ? `${error.type}${error.code ? ` (${error.code})` : ''} ` +
            `[http ${error.statusCode ?? '?'}]: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error)
      console.log(`  ${row.stripeSubscriptionId}: lookup failed — ${detail}`)
      continue
    }

    // The row query filters on the DB's status, so a row whose DB status has
    // drifted from Stripe lands here. Backfilling period dates onto a row that
    // Stripe considers dead would make a stale record look freshly maintained;
    // report it for status reconciliation instead.
    if (
      subscription.status === 'canceled' ||
      subscription.status === 'incomplete_expired'
    ) {
      staleStatus++
      console.log(
        `  ${row.stripeSubscriptionId}: db=${row.status} but Stripe=${subscription.status} ` +
          `— skipped, needs status reconciliation`
      )
      continue
    }

    const { periodStart, periodEnd } = extractPeriodDates(subscription)
    if (!periodEnd) {
      stillEmpty++
      console.log(
        `  ${row.stripeSubscriptionId}: Stripe returned no period end`
      )
      continue
    }

    // Stripe keeps status 'active' while pause_collection is set, so status
    // alone would infer "paid through periodEnd" for a subscription whose
    // invoices are being marked uncollectible or left as drafts. Nothing has
    // settled on a paused subscription — leave paidUntil for the invoice
    // webhook to set if collection resumes and an invoice actually pays.
    const collectionPaused = subscription.pause_collection != null

    // Only fill paidUntil when it is currently unset. A stored value came from
    // a settled invoice and outranks anything inferred here.
    const nextPaidUntil = collectionPaused
      ? row.paidUntil
      : (row.paidUntil ??
        resolveInitialPaidUntil(
          subscription.status as typeof row.status,
          periodEnd
        ))
    if (!row.paidUntil && nextPaidUntil)
      paidUntilSet.push(row.stripeSubscriptionId)

    filled++
    console.log(
      `  ${row.stripeSubscriptionId} [${row.stripeAccountType} ${row.status}] ` +
        `period -> ${periodEnd.toISOString().slice(0, 10)}` +
        `${!row.paidUntil && nextPaidUntil ? ', paidUntil set' : ''}`
    )

    if (apply) {
      await prisma.subscription.update({
        where: { id: row.id },
        data: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          paidUntil: nextPaidUntil,
        },
      })
    }
  }

  console.log(`\nfillable              : ${filled}`)
  console.log(`paidUntil would set   : ${paidUntilSet.length}`)
  console.log(`no period in Stripe   : ${stillEmpty}`)
  console.log(`lookup failed         : ${missingInStripe}`)
  console.log(`stale db status       : ${staleStatus}`)

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to write.')
  } else {
    console.log(`\nUpdated ${filled} subscription(s).`)
  }
}

runScript(main, { cleanup: () => prisma.$disconnect() })
