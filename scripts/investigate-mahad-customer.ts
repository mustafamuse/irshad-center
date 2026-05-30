/**
 * Investigate a Mahad Stripe customer's subscriptions + DB state.
 * Read-only.
 *
 * Usage:
 *   set -a && source .env.local && set +a && \
 *     NODE_ENV=production bunx tsx scripts/investigate-mahad-customer.ts --email <email>
 */

import { StripeAccountType } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { normalizeEmail } from '@/lib/utils/contact-normalization'
import { formatCurrency } from '@/lib/utils/formatters'
import { getStripeClient, getStripeCustomerId } from '@/lib/utils/stripe-client'

import { runScript } from './lib/run-script'

// Stripe's recent SDK moved current_period_start/end onto subscription items
// and renamed invoice.subscription. These narrow shapes cover both versions.
type SubWithLegacyPeriod = Stripe.Subscription & {
  current_period_start?: number
  current_period_end?: number
}
type InvWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
}

function parseEmailArg(): string {
  const args = process.argv.slice(2)
  const emailIdx = args.indexOf('--email')
  if (emailIdx === -1 || emailIdx + 1 >= args.length) {
    console.error(
      'Usage: investigate-mahad-customer.ts --email <customer-email>'
    )
    process.exit(1)
  }
  // Preserve casing: Stripe's customers.list email filter is case-sensitive,
  // so lowercasing here can miss a customer stored with a mixed-case email.
  const email = args[emailIdx + 1].trim()
  if (!email || !email.includes('@')) {
    console.error(`Invalid email: "${email}"`)
    process.exit(1)
  }
  return email
}

const CUSTOMER_EMAIL = parseEmailArg()
// Person.email is stored normalized (lowercase) — see normalizeEmail; use the
// normalized form for the DB lookup while the raw form drives the Stripe lookup.
const DB_EMAIL = normalizeEmail(CUSTOMER_EMAIL)

function fmtDate(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '-'
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.error(
      'ERROR: set NODE_ENV=production before running against live Stripe.\n' +
        'Without it getStripeClient selects test keys, querying the test account against the live DB.'
    )
    process.exit(1)
  }

  const stripe = getStripeClient(StripeAccountType.MAHAD)

  // Find the customer(s) with this email in Mahad
  const customerList = await stripe.customers.list({
    email: CUSTOMER_EMAIL,
    limit: 5,
  })
  console.log(
    `\nFound ${customerList.data.length} Stripe customer(s) for ${CUSTOMER_EMAIL}\n`
  )

  for (const customer of customerList.data) {
    console.log('='.repeat(78))
    console.log(`CUSTOMER: ${customer.id}`)
    console.log(`  Name:        ${customer.name ?? '-'}`)
    console.log(`  Email:       ${customer.email}`)
    console.log(`  Phone:       ${customer.phone ?? '-'}`)
    console.log(`  Created:     ${fmtDate(customer.created)}`)
    console.log(`  Description: ${customer.description ?? '-'}`)
    console.log(`  Delinquent:  ${customer.delinquent}`)
    console.log(`  Metadata:    ${JSON.stringify(customer.metadata)}`)

    // All subscriptions including canceled (auto-paginated for full history)
    const subs: Stripe.Subscription[] = []
    for await (const sub of stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 100,
    })) {
      subs.push(sub)
    }
    console.log(`\n  Subscriptions: ${subs.length}`)
    for (const sub of subs) {
      console.log(`\n  --- Sub ${sub.id} ---`)
      console.log(`    Status:           ${sub.status}`)
      console.log(
        `    Amount:           ${formatCurrency(sub.items.data[0]?.price.unit_amount ?? 0)}`
      )
      console.log(
        `    Interval:         every ${sub.items.data[0]?.price.recurring?.interval_count ?? 1} ${sub.items.data[0]?.price.recurring?.interval ?? '?'}`
      )
      console.log(`    Created:          ${fmtDate(sub.created)}`)
      console.log(`    Started billing:  ${fmtDate(sub.start_date)}`)
      const subTyped = sub as SubWithLegacyPeriod
      const itemPeriodStart = sub.items.data[0]?.current_period_start
      const itemPeriodEnd = sub.items.data[0]?.current_period_end
      console.log(
        `    Current period:   ${fmtDate(itemPeriodStart ?? subTyped.current_period_start)} → ${fmtDate(itemPeriodEnd ?? subTyped.current_period_end)}`
      )
      console.log(`    Cancel at:        ${fmtDate(sub.cancel_at)}`)
      console.log(`    Canceled at:      ${fmtDate(sub.canceled_at)}`)
      console.log(`    Ended at:         ${fmtDate(sub.ended_at)}`)
      console.log(`    Metadata:         ${JSON.stringify(sub.metadata)}`)
      console.log(
        `    Description:      ${sub.items.data[0]?.price.product ?? '-'}`
      )
    }

    console.log('\n  Recent invoices (last 10):')
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 10,
    })
    for (const inv of invoices.data) {
      const invTyped = inv as InvWithSubscription
      const subRef =
        typeof invTyped.subscription === 'string'
          ? invTyped.subscription
          : (invTyped.subscription?.id ?? '-')
      console.log(
        `    ${fmtDate(inv.created)} | ${inv.status?.padEnd(8)} | ${formatCurrency(inv.amount_paid).padStart(10)} paid / ${formatCurrency(inv.amount_due).padStart(10)} due | sub:${subRef}`
      )
    }

    // Charges
    console.log('\n  Recent charges (last 10):')
    const charges = await stripe.charges.list({
      customer: customer.id,
      limit: 10,
    })
    for (const ch of charges.data) {
      console.log(
        `    ${fmtDate(ch.created)} | ${ch.status?.padEnd(10)} | ${formatCurrency(ch.amount).padStart(10)} | refunded:${ch.refunded}`
      )
    }
  }

  // Now look at DB side
  console.log('\n' + '='.repeat(78))
  console.log('DB SIDE')
  console.log('='.repeat(78))

  const person = await prisma.person.findFirst({
    where: { email: DB_EMAIL },
    include: {
      programProfiles: {
        include: {
          enrollments: true,
          assignments: { include: { subscription: true } },
        },
      },
      billingAccounts: {
        include: { subscriptions: { include: { assignments: true } } },
      },
      guardianRelationships: { include: { dependent: true } },
      dependentRelationships: { include: { guardian: true } },
    },
  })

  if (!person) {
    console.log('  No DB person found with this email')
  } else {
    console.log(`  Person: ${person.id} (${person.name})`)
    console.log(
      `    Email: ${person.email}, Phone: ${person.phone}, DOB: ${person.dateOfBirth?.toISOString().slice(0, 10)}`
    )

    console.log(
      `\n  Guardian-of: ${person.guardianRelationships.length} dependent(s)`
    )
    for (const g of person.guardianRelationships) {
      console.log(`    - ${g.dependent.name} (${g.role}, active=${g.isActive})`)
    }
    console.log(
      `  Dependent-of: ${person.dependentRelationships.length} guardian(s)`
    )
    for (const d of person.dependentRelationships) {
      console.log(`    - ${d.guardian.name} (${d.role}, active=${d.isActive})`)
    }

    console.log(`\n  ProgramProfiles: ${person.programProfiles.length}`)
    for (const p of person.programProfiles) {
      console.log(
        `    ${p.program} (${p.status}) — rate=${formatCurrency(p.monthlyRate)}, gradStatus=${p.graduationStatus}, payFreq=${p.paymentFrequency}, billType=${p.billingType}`
      )
      console.log(
        `      Enrollments: ${p.enrollments.length} (active: ${p.enrollments.filter((e) => !e.endDate).length})`
      )
      console.log(`      Assignments: ${p.assignments.length}`)
      for (const a of p.assignments) {
        console.log(
          `        ${formatCurrency(a.amount)} → sub ${a.subscription.stripeSubscriptionId} (active=${a.isActive})`
        )
      }
    }

    console.log(`\n  BillingAccounts: ${person.billingAccounts.length}`)
    for (const ba of person.billingAccounts) {
      console.log(
        `    ${ba.accountType}: customer=${getStripeCustomerId(ba, ba.accountType) ?? '-'} — subs: ${ba.subscriptions.length}`
      )
      for (const s of ba.subscriptions) {
        console.log(
          `      ${s.stripeSubscriptionId} (${s.status}) ${formatCurrency(s.amount)} — assignments: ${s.assignments.length}`
        )
      }
    }
  }
}

runScript(main, { cleanup: () => prisma.$disconnect() })
