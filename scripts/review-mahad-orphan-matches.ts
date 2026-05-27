/**
 * Review Mahad orphan-subscription matches (read-only).
 *
 * For each orphaned Stripe Mahad subscription, show the Stripe-side details
 * and the matched DB Person (if any) so a human can approve before any linking.
 *
 * Usage:
 *   set -a && source .env.local && set +a && NODE_ENV=production bunx tsx scripts/review-mahad-orphan-matches.ts
 */

import { prisma } from '@/lib/db'
import {
  getAllOrphanedSubscriptions,
  getPotentialStudentMatches,
} from '@/lib/services/link-subscriptions'

function fmt$(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

async function main() {
  const orphans = (await getAllOrphanedSubscriptions()).filter(
    (s) => s.program === 'MAHAD'
  )

  console.log(`\nFound ${orphans.length} orphaned Mahad subscriptions\n`)
  console.log('='.repeat(78))

  let matchableIdx = 0
  for (let i = 0; i < orphans.length; i++) {
    const sub = orphans[i]
    if (!sub.customerEmail) continue

    const matches = await getPotentialStudentMatches(sub.customerEmail, 'MAHAD')
    const available = matches.filter((m) => !m.hasSubscription)

    if (available.length !== 1) continue

    matchableIdx++
    const match = available[0]

    // Fetch the full profile for current Mahad billing fields
    const profile = await prisma.programProfile.findUnique({
      where: { id: match.id },
      select: {
        id: true,
        status: true,
        monthlyRate: true,
        graduationStatus: true,
        paymentFrequency: true,
        billingType: true,
        person: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            dateOfBirth: true,
          },
        },
      },
    })

    console.log(`\n[Match ${matchableIdx}] Stripe sub ${sub.id}`)
    console.log('-'.repeat(78))
    console.log(`  STRIPE SIDE`)
    console.log(`    Sub ID:        ${sub.id}`)
    console.log(`    Status:        ${sub.status}`)
    console.log(`    Amount:        ${fmt$(sub.amount)}`)
    console.log(
      `    Customer:      ${sub.customerName ?? '(none)'} <${sub.customerEmail}>`
    )
    console.log(`    Customer ID:   ${sub.customerId}`)
    console.log(`    Created:       ${sub.created.toISOString().slice(0, 10)}`)
    console.log(
      `    Period:        ${sub.currentPeriodStart?.toISOString().slice(0, 10) ?? '?'} → ${sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? '?'}`
    )
    console.log(
      `    metadata.studentName:       ${sub.metadata?.studentName ?? '-'}`
    )
    console.log(
      `    metadata.personId (stale):  ${sub.metadata?.personId ?? '-'}`
    )
    console.log(
      `    metadata.graduationStatus:  ${sub.metadata?.graduationStatus ?? '-'}`
    )
    console.log(
      `    metadata.paymentFrequency:  ${sub.metadata?.paymentFrequency ?? '-'}`
    )
    console.log(
      `    metadata.billingType:       ${sub.metadata?.billingType ?? '-'}`
    )
    console.log(
      `    metadata.calculatedRate:    ${sub.metadata?.calculatedRate ?? '-'}`
    )

    console.log(`  DB SIDE`)
    console.log(`    Person ID:     ${profile?.person.id}`)
    console.log(`    Name:          ${profile?.person.name}`)
    console.log(`    Email:         ${profile?.person.email ?? '(none)'}`)
    console.log(`    Phone:         ${profile?.person.phone ?? '(none)'}`)
    console.log(
      `    DOB:           ${profile?.person.dateOfBirth?.toISOString().slice(0, 10) ?? '(none)'}`
    )
    console.log(`    Profile ID:    ${profile?.id}`)
    console.log(`    Profile status:${profile?.status}`)
    console.log(
      `    DB monthlyRate:${profile ? fmt$(profile.monthlyRate) : '?'}`
    )
    console.log(`    graduationStatus:  ${profile?.graduationStatus ?? '-'}`)
    console.log(`    paymentFrequency:  ${profile?.paymentFrequency ?? '-'}`)
    console.log(`    billingType:       ${profile?.billingType ?? '-'}`)

    // Sanity flags
    const flags: string[] = []
    if (sub.metadata?.studentName && profile?.person.name) {
      const stripeName = sub.metadata.studentName.toLowerCase().trim()
      const dbName = profile.person.name.toLowerCase().trim()
      if (!dbName.includes(stripeName) && !stripeName.includes(dbName)) {
        flags.push(
          `name mismatch: Stripe="${sub.metadata.studentName}" vs DB="${profile.person.name}"`
        )
      }
    }
    if (profile && sub.amount !== profile.monthlyRate) {
      flags.push(
        `amount diff: Stripe=${fmt$(sub.amount)} vs DB monthlyRate=${fmt$(profile.monthlyRate)}`
      )
    }
    if (
      sub.metadata?.graduationStatus &&
      profile?.graduationStatus &&
      sub.metadata.graduationStatus !== profile.graduationStatus
    ) {
      flags.push(
        `graduationStatus diff: ${sub.metadata.graduationStatus} vs ${profile.graduationStatus}`
      )
    }
    if (flags.length) {
      console.log(`  ⚠️  FLAGS`)
      for (const f of flags) console.log(`    - ${f}`)
    } else {
      console.log(`  ✓ clean match`)
    }
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`Total matchable: ${matchableIdx}`)
  console.log(`${'='.repeat(78)}\n`)
  await prisma.$disconnect()
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Review failed:', err)
    process.exit(1)
  })
