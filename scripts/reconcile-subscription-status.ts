/**
 * Reconcile Subscription.status against Stripe (dry-run by default)
 *
 * The DB's status can drift from Stripe's: a webhook that never arrived, one
 * that failed, or a mapping rule added after the fact. Drift in the direction
 * that matters — DB says a family is paying when Stripe says otherwise — is
 * invisible in the admin UI, because the UI trusts the DB.
 *
 * This compares every non-terminal row against Stripe and reports the diff.
 * It derives the expected status with deriveSubscriptionStatus, the same
 * function the subscription webhook uses, so a reconciled row cannot be flipped
 * straight back by the next webhook.
 *
 * Scope is deliberately narrow: this writes Subscription.status and nothing
 * else. It never touches paidUntil (settlement is the invoice webhook's, per
 * the invariant in CLAUDE.md), never touches amount, and never cascades to
 * program profiles or class enrollments. A subscription that Stripe canceled
 * months ago may still have enrolled students; withdrawing them is a decision
 * about real children attending real classes, not a data-repair side effect.
 * Such rows are reported under "needs enrollment review" for a human to act on.
 *
 * Stripe key mode is selected by NODE_ENV (lib/keys/stripe.ts), which is unset
 * under `bunx tsx` — without NODE_ENV=production this reads the test accounts
 * while writing the production database, and every live id 404s.
 *
 * Usage:
 *   set -a && source .env.local && set +a && \
 *     NODE_ENV=production bunx tsx scripts/reconcile-subscription-status.ts
 *   ... add --apply to write
 */

import { SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { stripeServerClient } from '@/lib/stripe-mahad'
import { deriveSubscriptionStatus } from '@/lib/utils/subscription-status'
import { isValidSubscriptionStatus } from '@/lib/utils/type-guards'

import { runScript } from './lib/run-script'

// Stripe considers these dead. A row reaching one of them may still carry
// enrolled students, so it is reported rather than silently reconciled.
const TERMINAL_STRIPE_STATUSES = new Set<SubscriptionStatus>([
  'canceled',
  'incomplete_expired',
])

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

  // Rows already terminal in the DB need no reconciliation: Stripe never
  // revives a canceled subscription, it issues a new one.
  const rows = await prisma.subscription.findMany({
    where: { status: { notIn: [...TERMINAL_STRIPE_STATUSES] } },
    select: {
      id: true,
      stripeSubscriptionId: true,
      stripeAccountType: true,
      status: true,
      assignments: { select: { id: true } },
    },
  })

  console.log(`\nChecking ${rows.length} non-terminal subscription(s)\n`)

  let inSync = 0
  let reconciled = 0
  let lookupFailed = 0
  const needsEnrollmentReview: string[] = []

  for (const row of rows) {
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
      lookupFailed++
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

    const rawStatus = subscription.status as SubscriptionStatus
    if (!isValidSubscriptionStatus(rawStatus)) {
      lookupFailed++
      console.log(
        `  ${row.stripeSubscriptionId}: Stripe returned unrecognized status ` +
          `"${subscription.status}" — skipped`
      )
      continue
    }

    const expected = deriveSubscriptionStatus(
      rawStatus,
      row.stripeAccountType,
      subscription.pause_collection
    )

    if (expected === row.status) {
      inSync++
      continue
    }

    const assignmentCount = row.assignments.length
    if (TERMINAL_STRIPE_STATUSES.has(expected) && assignmentCount > 0) {
      needsEnrollmentReview.push(
        `${row.stripeSubscriptionId} (db=${row.status} stripe=${expected}, ` +
          `${assignmentCount} billing assignment(s) still attached)`
      )
    }

    reconciled++
    console.log(
      `  ${row.stripeSubscriptionId} [${row.stripeAccountType}] ` +
        `${row.status} -> ${expected}`
    )

    if (apply) {
      await prisma.subscription.update({
        where: { id: row.id },
        data: { status: expected },
      })
    }
  }

  console.log(`\nalready in sync   : ${inSync}`)
  console.log(`status corrected  : ${reconciled}`)
  console.log(`lookup failed     : ${lookupFailed}`)

  if (needsEnrollmentReview.length > 0) {
    console.log(
      `\nNEEDS ENROLLMENT REVIEW (${needsEnrollmentReview.length}) — ` +
        `dead in Stripe but students are still attached. This script only ` +
        `corrected the status field; deciding whether to withdraw these ` +
        `students is a human call:`
    )
    for (const line of needsEnrollmentReview) console.log(`  ${line}`)
  }

  console.log(
    apply
      ? `\nUpdated ${reconciled} subscription(s).`
      : '\nDRY RUN — re-run with --apply to write.'
  )
}

runScript(main, { cleanup: () => prisma.$disconnect() })
