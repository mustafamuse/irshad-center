/**
 * Dugsi Subscription Verification Script
 *
 * Verifies that a Dugsi Stripe subscription was properly linked to the database.
 * Checks metadata matches database records for family-based billing.
 *
 * Usage:
 *   npx tsx scripts/verify-dugsi-subscription.ts sub_xxx
 *
 * Output:
 *   - Stripe metadata vs DB values comparison
 *   - Family/children linking status
 *   - Rate verification
 */

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

const subscriptionId = process.argv[2]

if (!subscriptionId) {
  console.error(
    'Usage: npx tsx scripts/verify-dugsi-subscription.ts <subscription_id>'
  )
  console.error(
    'Example: npx tsx scripts/verify-dugsi-subscription.ts sub_1SYoMpEPoTboEBNAAX64pewy'
  )
  process.exit(1)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('DUGSI SUBSCRIPTION VERIFICATION')
  console.log('='.repeat(60))
  console.log(`Subscription ID: ${subscriptionId}\n`)

  // 1. Fetch subscription from Stripe
  console.log('1. Fetching from Stripe...')
  const stripe = getDugsiStripeClient()

  let stripeSubscription
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    console.error(
      `   ❌ Failed to fetch subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    process.exit(1)
  }

  console.log('   ✅ Subscription found')
  console.log(`   Status: ${stripeSubscription.status}`)
  console.log(`   Customer: ${stripeSubscription.customer}`)

  // 2. Extract metadata
  console.log('\n2. Stripe Metadata:')
  const metadata = stripeSubscription.metadata || {}

  const expectedFields = [
    'familyId',
    'guardianPersonId',
    'childCount',
    'profileIds',
    'calculatedRate',
    'overrideUsed',
    'source',
  ]

  const missingFields: string[] = []
  for (const field of expectedFields) {
    const value = metadata[field]
    if (value) {
      console.log(`   ${field}: ${value}`)
    } else {
      console.log(`   ${field}: ⚠️  MISSING`)
      missingFields.push(field)
    }
  }

  // Also show human-readable fields
  console.log('\n   Human-readable:')
  const humanFields = ['Family', 'Children', 'Rate', 'Tier', 'Source']
  for (const field of humanFields) {
    const value = metadata[field]
    if (value) {
      console.log(`   ${field}: ${value}`)
    }
  }

  if (missingFields.length > 0) {
    console.log(`\n   ⚠️  Missing fields: ${missingFields.join(', ')}`)
  }

  const { familyId, guardianPersonId, childCount, profileIds, calculatedRate } =
    metadata

  // 3. Query database
  console.log('\n3. Database Verification:')

  // 3a. Check Family Profiles
  console.log('\n   3a. Family Profiles:')
  if (profileIds) {
    const profileIdList = profileIds.split(',').filter(Boolean)
    const profiles = await prisma.programProfile.findMany({
      where: {
        id: { in: profileIdList },
      },
      include: {
        person: true,
      },
    })

    if (profiles.length === profileIdList.length) {
      console.log(
        `       ✅ Found ${profiles.length} profiles for family ${familyId || 'unknown'}`
      )
      for (const profile of profiles) {
        console.log(`       - ${profile.person.name} (${profile.id})`)
        if (
          familyId &&
          profile.familyReferenceId &&
          profile.familyReferenceId !== familyId
        ) {
          console.log(
            `         ⚠️  familyReferenceId mismatch: ${profile.familyReferenceId}`
          )
        }
      }
    } else {
      console.log(
        `       ⚠️  Found ${profiles.length}/${profileIdList.length} profiles`
      )
      const foundIds = profiles.map((p) => p.id)
      const missingIds = profileIdList.filter((id) => !foundIds.includes(id))
      for (const id of missingIds) {
        console.log(`       ❌ Missing: ${id}`)
      }
    }

    // Verify childCount
    if (childCount) {
      const expectedCount = parseInt(childCount, 10)
      if (profiles.length !== expectedCount) {
        console.log(
          `       ⚠️  Child count mismatch: DB=${profiles.length}, Stripe=${expectedCount}`
        )
      } else {
        console.log(`       ✅ Child count matches: ${expectedCount}`)
      }
    }
  } else {
    console.log('       ⚠️  No profileIds in metadata')
  }

  // 3b. Check Subscription record
  console.log('\n   3b. Subscription Record:')
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      billingAccount: {
        include: {
          person: true,
        },
      },
      assignments: {
        include: {
          programProfile: {
            include: {
              person: true,
            },
          },
        },
      },
    },
  })

  if (dbSubscription) {
    console.log(`       ✅ Found in database`)
    console.log(`       Status: ${dbSubscription.status}`)
    console.log(
      `       Billing Account: ${dbSubscription.billingAccount?.person?.name || 'NOT LINKED'}`
    )
    console.log(`       Linked Profiles: ${dbSubscription.assignments.length}`)

    if (profileIds) {
      const profileIdList = profileIds.split(',').filter(Boolean)
      const linkedIds = dbSubscription.assignments.map(
        (a) => a.programProfile.id
      )
      const unlinkedIds = profileIdList.filter((id) => !linkedIds.includes(id))
      if (unlinkedIds.length > 0) {
        console.log(`       ⚠️  Profiles not linked: ${unlinkedIds.join(', ')}`)
      }
    }
  } else {
    console.log(`       ❌ NOT FOUND - Subscription not in database`)
  }

  // 3c. Check BillingAccount
  if (guardianPersonId) {
    console.log('\n   3c. BillingAccount:')
    const billingAccount = await prisma.billingAccount.findFirst({
      where: { personId: guardianPersonId },
      include: {
        person: true,
      },
    })

    if (billingAccount) {
      console.log(
        `       ✅ Found for ${billingAccount.person?.name ?? 'Unknown'}`
      )
      console.log(
        `       Stripe Customer (Dugsi): ${billingAccount.stripeCustomerIdDugsi || 'NOT SET'}`
      )

      if (!billingAccount.stripeCustomerIdDugsi) {
        console.log(`       ⚠️  Dugsi customer ID not set`)
      }
    } else {
      console.log(
        `       ❌ NOT FOUND for guardianPersonId: ${guardianPersonId}`
      )
    }
  } else {
    console.log('\n   3c. BillingAccount: ⚠️  No guardianPersonId in metadata')
  }

  // 3d. Check BillingAssignments
  if (profileIds) {
    console.log('\n   3d. BillingAssignments:')
    const profileIdList = profileIds.split(',').filter(Boolean)

    const assignments = await prisma.billingAssignment.findMany({
      where: { programProfileId: { in: profileIdList } },
      orderBy: { createdAt: 'desc' },
    })

    if (assignments.length > 0) {
      console.log(`       ✅ Found ${assignments.length} assignments`)
      const totalAmount = assignments.reduce((sum, a) => sum + a.amount, 0)
      console.log(`       Total Amount: ${formatCurrency(totalAmount)}`)

      if (calculatedRate) {
        const expectedAmount = parseInt(calculatedRate, 10)
        if (totalAmount !== expectedAmount) {
          console.log(
            `       ⚠️  Amount mismatch: DB=${formatCurrency(totalAmount)}, Stripe=${formatCurrency(expectedAmount)}`
          )
        } else {
          console.log(`       ✅ Amount matches Stripe metadata`)
        }
      }
    } else {
      console.log(`       ❌ No assignments found`)
    }
  } else {
    console.log('\n   3d. BillingAssignments: ⚠️  No profileIds in metadata')
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const issues: string[] = []

  if (missingFields.length > 0) {
    issues.push(`Missing metadata fields: ${missingFields.join(', ')}`)
  }
  if (!dbSubscription) {
    issues.push('Subscription not found in database')
  }
  if (dbSubscription && profileIds) {
    const profileIdList = profileIds.split(',').filter(Boolean)
    const linkedIds = dbSubscription.assignments.map((a) => a.programProfile.id)
    const unlinkedCount = profileIdList.filter(
      (id) => !linkedIds.includes(id)
    ).length
    if (unlinkedCount > 0) {
      issues.push(`${unlinkedCount} profiles not linked to subscription`)
    }
  }

  if (issues.length === 0) {
    console.log('✅ All checks passed - subscription properly linked')
  } else {
    console.log('⚠️  Issues found:')
    for (const issue of issues) {
      console.log(`   - ${issue}`)
    }
  }

  console.log('')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
