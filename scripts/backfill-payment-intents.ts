/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Backfill PaymentIntent IDs for Existing Families
 *
 * This script retrieves PaymentIntent IDs from Stripe for families that
 * have payment methods captured but are missing PaymentIntent IDs.
 *
 * It fetches real-time status from Stripe API to show actual verification status.
 *
 * Usage:
 *   npx tsx scripts/backfill-payment-intents.ts            # Apply changes
 */

import { PrismaClient } from '@prisma/client'

import { getDugsiStripeClient } from '../lib/stripe-dugsi'

const prisma = new PrismaClient()
const stripe = getDugsiStripeClient()

interface FamilyData {
  customerId: string
  parentEmail: string | null
  parentName: string
  students: Array<{
    id: string
    name: string
  }>
  paymentMethodCapturedAt: Date | null
  subscriptionId: string | null
  subscriptionStatus: string | null
}

async function backfillPaymentIntents(dryRun: boolean = true) {
  console.log('🔍 Backfilling PaymentIntent IDs for existing families...\n')
  console.log('='.repeat(80))

  if (dryRun) {
    console.log('🔒 DRY RUN MODE - No database changes will be made\n')
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\n')
  }

  try {
    // Find all students with payment captured but missing PaymentIntent ID
    const students = await prisma.student.findMany({
      where: {
        program: 'DUGSI_PROGRAM',
        paymentMethodCaptured: true,
        stripeCustomerIdDugsi: { not: null },
        paymentIntentIdDugsi: null, // Missing PaymentIntent ID
      },
      select: {
        id: true,
        name: true,
        stripeCustomerIdDugsi: true,
        stripeSubscriptionIdDugsi: true,
        subscriptionStatus: true,
        paymentMethodCapturedAt: true,
        parentEmail: true,
        parentFirstName: true,
        parentLastName: true,
      },
      orderBy: {
        paymentMethodCapturedAt: 'asc', // Oldest first
      },
    })

    if (students.length === 0) {
      console.log('✅ No families found needing PaymentIntent ID backfill!')
      return
    }

    // Group by customer ID
    const familiesMap = new Map<string, FamilyData>()

    students.forEach((student) => {
      const customerId = student.stripeCustomerIdDugsi!

      if (!familiesMap.has(customerId)) {
        familiesMap.set(customerId, {
          customerId,
          parentEmail: student.parentEmail,
          parentName:
            `${student.parentFirstName || ''} ${student.parentLastName || ''}`.trim() ||
            'Unknown',
          students: [],
          paymentMethodCapturedAt: student.paymentMethodCapturedAt,
          subscriptionId: student.stripeSubscriptionIdDugsi,
          subscriptionStatus: student.subscriptionStatus,
        })
      }

      familiesMap.get(customerId)!.students.push({
        id: student.id,
        name: student.name,
      })
    })

    const families = Array.from(familiesMap.values())

    console.log(
      `📊 Found ${families.length} families needing PaymentIntent IDs`
    )
    console.log(`   Total students affected: ${students.length}\n`)

    // Process each family
    let successCount = 0
    let failureCount = 0
    const updates: Array<{
      customerId: string
      paymentIntentId: string
      studentCount: number
      status: string
    }> = []

    for (let index = 0; index < families.length; index++) {
      const family = families[index]
      console.log(`\n${'='.repeat(80)}`)
      console.log(
        `Family ${index + 1}/${families.length}: ${family.parentName}`
      )
      console.log('='.repeat(80))
      console.log(`Customer ID: ${family.customerId}`)
      console.log(`Email: ${family.parentEmail || 'N/A'}`)
      console.log(`Students (${family.students.length}):`)
      family.students.forEach((s) => console.log(`  - ${s.name} (${s.id})`))

      if (family.paymentMethodCapturedAt) {
        console.log(
          `Payment Captured: ${family.paymentMethodCapturedAt.toLocaleDateString()}`
        )
      }

      console.log(`\n📡 Fetching from Stripe...`)

      try {
        // Try to find subscription in Stripe by customer ID
        let subscription: any = null

        if (family.subscriptionId) {
          // If we have subscription ID in DB, use it
          subscription = await stripe.subscriptions.retrieve(
            family.subscriptionId
          )
          console.log(
            `✅ Found subscription from database ID: ${subscription.id}`
          )
        } else {
          // No subscription ID in DB - search Stripe for subscriptions by customer
          console.log(
            `⚠️  No subscription ID in database - searching Stripe...`
          )
          const subscriptions = await stripe.subscriptions.list({
            customer: family.customerId,
            limit: 10,
          })

          if (subscriptions.data.length === 0) {
            console.log(`❌ No subscriptions found in Stripe for this customer`)
            failureCount++
            continue
          }

          // Use the most recent subscription
          subscription = subscriptions.data[0]
          console.log(
            `✅ Found subscription in Stripe: ${subscription.id} (status: ${subscription.status})`
          )
          console.log(
            `   Note: This subscription exists in Stripe but not in your database!`
          )
        }
        console.log(
          `✅ Subscription: ${subscription.id} (status: ${subscription.status})`
        )

        // Search for PaymentIntents by customer ID
        // (Invoice.payment_intent is null for these old subscriptions)
        console.log(`\n💳 Searching for PaymentIntents...`)
        const paymentIntents = await stripe.paymentIntents.list({
          customer: family.customerId,
          limit: 10,
        })

        if (paymentIntents.data.length === 0) {
          console.log(`⚠️  No PaymentIntents found for customer - skipping`)
          failureCount++
          continue
        }

        // Find the PaymentIntent for this subscription
        // Look for one that's requires_action (waiting for microdeposit verification)
        let foundPI = paymentIntents.data.find(
          (pi) =>
            pi.status === 'requires_action' ||
            pi.status === 'requires_payment_method'
        )

        // If no requires_action, take the most recent one
        if (!foundPI) {
          foundPI = paymentIntents.data[0]
        }

        const paymentIntentId = foundPI.id
        console.log(
          `✅ Found PaymentIntent: ${paymentIntentId} (status: ${foundPI.status})`
        )

        // Fetch the actual PaymentIntent to get real-time status and details
        console.log(`\n📊 Checking PaymentIntent details...`)
        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId)

        console.log(`   Status: ${paymentIntent.status}`)
        console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`)
        console.log(
          `   Payment Method: ${paymentIntent.payment_method || 'N/A'}`
        )

        // Check if it requires verification
        if (paymentIntent.next_action) {
          console.log(`\n⚠️  Next Action Required:`)
          console.log(`   Type: ${paymentIntent.next_action.type}`)

          if (paymentIntent.next_action.type === 'verify_with_microdeposits') {
            const microdeposits =
              paymentIntent.next_action.verify_with_microdeposits
            console.log(
              `   Microdeposit Type: ${microdeposits?.microdeposit_type || 'N/A'}`
            )

            if (microdeposits?.arrival_date) {
              const arrivalDate = new Date(microdeposits.arrival_date * 1000)
              console.log(
                `   Arrival Date: ${arrivalDate.toLocaleDateString()}`
              )

              // Calculate if expired
              const now = new Date()
              const daysUntilArrival = Math.ceil(
                (arrivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              )

              if (daysUntilArrival < 0) {
                console.log(
                  `   ⏰ Deposits should have arrived ${Math.abs(daysUntilArrival)} days ago`
                )
              } else {
                console.log(
                  `   ⏰ Deposits arriving in ~${daysUntilArrival} days`
                )
              }
            }

            if (microdeposits?.hosted_verification_url) {
              console.log(
                `   🔗 Verification URL: ${microdeposits.hosted_verification_url}`
              )
            }
          }
        } else if (paymentIntent.status === 'succeeded') {
          console.log(`\n✅ PaymentIntent succeeded - bank account verified!`)
        } else if (paymentIntent.status === 'processing') {
          console.log(
            `\n⏳ PaymentIntent processing - ACH transfer in progress`
          )
        } else if (paymentIntent.status === 'requires_payment_method') {
          console.log(`\n⚠️  PaymentIntent requires new payment method`)
        }

        if (!dryRun) {
          // Update database with PaymentIntent ID and Subscription ID if missing
          console.log(`\n💾 Updating ${family.students.length} students...`)

          const updateData: any = {
            paymentIntentIdDugsi: paymentIntentId,
          }

          // If subscription wasn't in DB, add it
          if (!family.subscriptionId) {
            updateData.stripeSubscriptionIdDugsi = subscription.id
            updateData.subscriptionStatus = subscription.status
            console.log(`   Also updating subscription ID: ${subscription.id}`)
          }

          const updateResult = await prisma.student.updateMany({
            where: {
              program: 'DUGSI_PROGRAM',
              stripeCustomerIdDugsi: family.customerId,
            },
            data: updateData,
          })

          console.log(
            `✅ Updated ${updateResult.count} students with PaymentIntent ID`
          )
          successCount++

          updates.push({
            customerId: family.customerId,
            paymentIntentId,
            studentCount: updateResult.count,
            status: paymentIntent.status,
          })
        } else {
          console.log(
            `\n🔒 DRY RUN: Would update ${family.students.length} students`
          )
          successCount++

          updates.push({
            customerId: family.customerId,
            paymentIntentId,
            studentCount: family.students.length,
            status: paymentIntent.status,
          })
        }
      } catch (error: any) {
        console.error(`❌ Error processing family:`, error.message)
        failureCount++
      }
    }

    // Summary
    console.log(`\n\n${'='.repeat(80)}`)
    console.log('📊 SUMMARY')
    console.log('='.repeat(80))
    console.log(`Total families processed: ${families.length}`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)

    if (updates.length > 0) {
      console.log(`\n💾 Updates ${dryRun ? '(would be)' : ''} made:`)
      updates.forEach((update) => {
        console.log(
          `  - ${update.customerId}: ${update.studentCount} students → ${update.paymentIntentId} (${update.status})`
        )
      })
    }

    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to apply these changes`)
    } else {
      console.log(`\n✅ Backfill complete!`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

backfillPaymentIntents(dryRun)
  .then(() => {
    console.log('\n✅ Script complete!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
