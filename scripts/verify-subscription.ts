/**
 * Subscription Verification Script
 *
 * Verifies that a Stripe subscription was properly linked to the database.
 * Checks metadata matches database records.
 *
 * Usage:
 *   npx tsx scripts/verify-subscription.ts sub_1SYAUfFsdFzP1bzTTdjuOZnZ
 *
 * Output:
 *   - Stripe metadata vs DB values comparison
 *   - Subscription linking status
 *   - BillingAssignment amount verification
 */

import { prisma } from '@/lib/db'
import { getMahadStripeClient } from '@/lib/stripe-mahad'

const subscriptionId = process.argv[2]

if (!subscriptionId) {
  console.error(
    'Usage: npx tsx scripts/verify-subscription.ts <subscription_id>'
  )
  console.error(
    'Example: npx tsx scripts/verify-subscription.ts sub_1SYAUfFsdFzP1bzTTdjuOZnZ'
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
  console.log('SUBSCRIPTION VERIFICATION')
  console.log('='.repeat(60))
  console.log(`Subscription ID: ${subscriptionId}\n`)

  // 1. Fetch subscription from Stripe
  console.log('1. Fetching from Stripe...')
  const stripe = getMahadStripeClient()

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
    'profileId',
    'personId',
    'studentName',
    'graduationStatus',
    'paymentFrequency',
    'billingType',
    'calculatedRate',
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

  if (missingFields.length > 0) {
    console.log(`\n   ⚠️  Missing fields: ${missingFields.join(', ')}`)
  }

  const { profileId, personId, calculatedRate } = metadata

  // 3. Query database
  console.log('\n3. Database Verification:')

  // 3a. Check ProgramProfile
  if (profileId) {
    console.log('\n   3a. ProgramProfile:')
    const profile = await prisma.programProfile.findUnique({
      where: { id: profileId },
      include: {
        person: true,
      },
    })

    if (profile) {
      console.log(`       ✅ Found: ${profile.person.name}`)
      console.log(
        `       Graduation Status: ${profile.graduationStatus || 'NOT SET'}`
      )
      console.log(
        `       Payment Frequency: ${profile.paymentFrequency || 'NOT SET'}`
      )
      console.log(`       Billing Type: ${profile.billingType || 'NOT SET'}`)

      // Compare with Stripe metadata
      if (
        metadata.graduationStatus &&
        profile.graduationStatus !== metadata.graduationStatus
      ) {
        console.log(
          `       ⚠️  Graduation status mismatch: DB=${profile.graduationStatus}, Stripe=${metadata.graduationStatus}`
        )
      }
      if (
        metadata.paymentFrequency &&
        profile.paymentFrequency !== metadata.paymentFrequency
      ) {
        console.log(
          `       ⚠️  Payment frequency mismatch: DB=${profile.paymentFrequency}, Stripe=${metadata.paymentFrequency}`
        )
      }
      if (
        metadata.billingType &&
        profile.billingType !== metadata.billingType
      ) {
        console.log(
          `       ⚠️  Billing type mismatch: DB=${profile.billingType}, Stripe=${metadata.billingType}`
        )
      }
    } else {
      console.log(`       ❌ NOT FOUND`)
    }
  } else {
    console.log('\n   3a. ProgramProfile: ⚠️  No profileId in metadata')
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
          programProfile: true,
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

    if (
      profileId &&
      !dbSubscription.assignments.some((a) => a.programProfile.id === profileId)
    ) {
      console.log(`       ⚠️  Profile ${profileId} not linked to subscription`)
    }
  } else {
    console.log(`       ❌ NOT FOUND - Subscription not in database`)
  }

  // 3c. Check BillingAccount
  if (personId) {
    console.log('\n   3c. BillingAccount:')
    const billingAccount = await prisma.billingAccount.findFirst({
      where: { personId },
      include: {
        person: true,
      },
    })

    if (billingAccount) {
      console.log(
        `       ✅ Found for ${billingAccount.person?.name ?? 'Unknown'}`
      )
      console.log(
        `       Stripe Customer (Mahad): ${billingAccount.stripeCustomerIdMahad || 'NOT SET'}`
      )
    } else {
      console.log(`       ❌ NOT FOUND`)
    }
  } else {
    console.log('\n   3c. BillingAccount: ⚠️  No personId in metadata')
  }

  // 3d. Check BillingAssignment
  if (profileId) {
    console.log('\n   3d. BillingAssignment:')
    const assignment = await prisma.billingAssignment.findFirst({
      where: { programProfileId: profileId },
      orderBy: { createdAt: 'desc' },
    })

    if (assignment) {
      console.log(`       ✅ Found`)
      console.log(`       Amount: ${formatCurrency(assignment.amount)}`)

      if (calculatedRate) {
        const expectedAmount = parseInt(calculatedRate, 10)
        if (assignment.amount !== expectedAmount) {
          console.log(
            `       ⚠️  Amount mismatch: DB=${formatCurrency(assignment.amount)}, Stripe=${formatCurrency(expectedAmount)}`
          )
        } else {
          console.log(`       ✅ Amount matches Stripe metadata`)
        }
      }
    } else {
      console.log(`       ❌ NOT FOUND`)
    }
  } else {
    console.log('\n   3d. BillingAssignment: ⚠️  No profileId in metadata')
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
  if (
    dbSubscription &&
    profileId &&
    !dbSubscription.assignments.some((a) => a.programProfile.id === profileId)
  ) {
    issues.push('Profile not linked to subscription')
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
