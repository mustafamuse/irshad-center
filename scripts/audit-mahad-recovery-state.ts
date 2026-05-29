/**
 * Mahad Recovery State Audit (read-only)
 *
 * Counts the surviving DB rows vs live Stripe state to determine the
 * actual recovery gap.
 *
 * Usage:
 *   set -a && source .env.local && set +a && bunx tsx scripts/audit-mahad-recovery-state.ts
 */

import { Program, StripeAccountType } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getStripeClient } from '@/lib/utils/stripe-client'

import { runScript } from './lib/run-script'

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.error(
      'ERROR: set NODE_ENV=production before running against live Stripe.\n' +
        'Without it getStripeClient selects test keys, comparing Stripe-test vs DB-live.'
    )
    process.exit(1)
  }

  const mahad = getStripeClient(StripeAccountType.MAHAD)

  // --- Stripe-side counts ---
  let stripeActiveCount = 0
  let stripeCount = 0
  for await (const sub of mahad.subscriptions.list({ limit: 100 })) {
    stripeCount++
    if (['active', 'trialing', 'past_due'].includes(sub.status)) {
      stripeActiveCount++
    }
  }

  // --- DB-side counts ---
  const personCount = await prisma.person.count()
  const mahadProfileCount = await prisma.programProfile.count({
    where: { program: Program.MAHAD_PROGRAM },
  })
  const mahadProfilesUnique = await prisma.programProfile.groupBy({
    by: ['personId'],
    where: { program: Program.MAHAD_PROGRAM },
  })
  const mahadEnrollmentActive = await prisma.enrollment.count({
    where: {
      programProfile: { program: Program.MAHAD_PROGRAM },
      endDate: null,
    },
  })
  const mahadBillingAccountTotal = await prisma.billingAccount.count({
    where: { accountType: StripeAccountType.MAHAD },
  })
  const mahadBillingAccountOrphan = await prisma.billingAccount.count({
    where: { accountType: StripeAccountType.MAHAD, personId: null },
  })
  const mahadBillingAccountWithPerson = await prisma.billingAccount.count({
    where: { accountType: StripeAccountType.MAHAD, personId: { not: null } },
  })
  const mahadSubscriptions = await prisma.subscription.count({
    where: { stripeAccountType: StripeAccountType.MAHAD },
  })
  const mahadSubsActive = await prisma.subscription.count({
    where: {
      stripeAccountType: StripeAccountType.MAHAD,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
  })
  const mahadAssignmentsTotal = await prisma.billingAssignment.count({
    where: { subscription: { stripeAccountType: StripeAccountType.MAHAD } },
  })
  const mahadAssignmentsActive = await prisma.billingAssignment.count({
    where: {
      subscription: { stripeAccountType: StripeAccountType.MAHAD },
      isActive: true,
    },
  })
  const mahadSubsWithoutAssignments = await prisma.subscription.count({
    where: {
      stripeAccountType: StripeAccountType.MAHAD,
      assignments: { none: {} },
    },
  })
  const mahadActiveSubsWithoutAssignments = await prisma.subscription.count({
    where: {
      stripeAccountType: StripeAccountType.MAHAD,
      status: { in: ['active', 'trialing', 'past_due'] },
      assignments: { none: {} },
    },
  })

  console.log('\n' + '='.repeat(70))
  console.log('MAHAD RECOVERY STATE AUDIT (read-only)')
  console.log('='.repeat(70))

  console.log('\n--- Stripe (live) ---')
  console.log(`  Total subscriptions:               ${stripeCount}`)
  console.log(`  Active/trialing/past_due:          ${stripeActiveCount}`)

  console.log('\n--- DB: People + Profiles ---')
  console.log(`  Person rows (all programs):        ${personCount}`)
  console.log(`  Mahad ProgramProfile rows:         ${mahadProfileCount}`)
  console.log(
    `    ...distinct Persons:             ${mahadProfilesUnique.length}`
  )
  console.log(`  Mahad active enrollments:          ${mahadEnrollmentActive}`)

  console.log('\n--- DB: Billing ---')
  console.log(
    `  BillingAccount (MAHAD) total:      ${mahadBillingAccountTotal}`
  )
  console.log(
    `    ...with personId NULL (orphan):  ${mahadBillingAccountOrphan}`
  )
  console.log(
    `    ...with personId set:            ${mahadBillingAccountWithPerson}`
  )
  console.log(`  Subscription (MAHAD) total:        ${mahadSubscriptions}`)
  console.log(`    ...active/trialing/past_due:     ${mahadSubsActive}`)
  console.log(`  BillingAssignment (MAHAD) total:   ${mahadAssignmentsTotal}`)
  console.log(`    ...active:                       ${mahadAssignmentsActive}`)

  console.log('\n--- The recovery gap ---')
  console.log(
    `  Subscriptions with NO assignment:  ${mahadSubsWithoutAssignments}`
  )
  console.log(
    `    ...of those, active:             ${mahadActiveSubsWithoutAssignments}`
  )

  console.log('\n--- Implied state ---')
  const drift = stripeActiveCount - mahadSubsActive
  console.log(`  Stripe-vs-DB active drift:         ${drift}`)
  if (mahadActiveSubsWithoutAssignments > 0) {
    console.log(
      `  >>> ${mahadActiveSubsWithoutAssignments} active Mahad subs have no BillingAssignment <<<`
    )
    console.log(
      `      => active customers being billed with no link to any student`
    )
  }

  console.log('\n' + '='.repeat(70) + '\n')
}

runScript(main, { cleanup: () => prisma.$disconnect() })
