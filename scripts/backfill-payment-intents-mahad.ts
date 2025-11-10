/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Backfill PaymentIntent IDs for Existing Mahad Students
 *
 * This script retrieves PaymentIntent IDs from Stripe for Mahad students that
 * have active subscriptions but are missing PaymentIntent IDs.
 *
 * Usage:
 *   npx tsx scripts/backfill-payment-intents-mahad.ts            # Dry run
 *   npx tsx scripts/backfill-payment-intents-mahad.ts --apply    # Apply changes
 */

import { PrismaClient } from '@prisma/client'

import { getStripeClient } from '../lib/stripe'

const prisma = new PrismaClient()
const stripe = getStripeClient()

interface StudentData {
  id: string
  name: string
  subscriptionId: string
  customerId: string | null
  parentEmail: string | null
  subscriptionStatus: string | null
}

async function backfillPaymentIntents(dryRun: boolean = true) {
  console.log('🔍 Backfilling PaymentIntent IDs for Mahad students...\n')
  console.log('='.repeat(80))

  if (dryRun) {
    console.log('🔒 DRY RUN MODE - No database changes will be made\n')
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\n')
  }

  try {
    // Find all Mahad students with subscriptions but missing PaymentIntent ID
    const students = await prisma.student.findMany({
      where: {
        program: 'MAHAD_PROGRAM',
        stripeSubscriptionId: { not: null },
        paymentIntentIdMahad: null, // Missing PaymentIntent ID
      },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        parentEmail: true,
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    })

    if (students.length === 0) {
      console.log('✅ No Mahad students found needing PaymentIntent ID backfill!')
      return
    }

    console.log(
      `📊 Found ${students.length} Mahad students needing PaymentIntent IDs\n`
    )

    let successCount = 0
    let failureCount = 0
    const updates: Array<{
      studentId: string
      name: string
      subscriptionId: string
      paymentIntentId: string
    }> = []

    for (let index = 0; index < students.length; index++) {
      const student = students[index]
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Student ${index + 1}/${students.length}: ${student.name}`)
      console.log('='.repeat(80))
      console.log(`Student ID: ${student.id}`)
      console.log(`Subscription ID: ${student.stripeSubscriptionId}`)
      console.log(`Email: ${student.parentEmail || 'N/A'}`)

      console.log(`\n📡 Fetching from Stripe...`)

      try {
        // Retrieve subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(
          student.stripeSubscriptionId!,
          {
            expand: ['latest_invoice.payment_intent'],
          }
        )

        console.log(
          `✅ Subscription: ${subscription.id} (status: ${subscription.status})`
        )

        // Get PaymentIntent from latest invoice
        const latestInvoice = subscription.latest_invoice as any
        const paymentIntentId =
          typeof latestInvoice?.payment_intent === 'string'
            ? latestInvoice.payment_intent
            : latestInvoice?.payment_intent?.id

        if (!paymentIntentId) {
          console.log(`⚠️  No PaymentIntent found for subscription - skipping`)
          failureCount++
          continue
        }

        console.log(`✅ Found PaymentIntent: ${paymentIntentId}`)

        updates.push({
          studentId: student.id,
          name: student.name,
          subscriptionId: student.stripeSubscriptionId!,
          paymentIntentId,
        })

        if (!dryRun) {
          await prisma.student.update({
            where: { id: student.id },
            data: { paymentIntentIdMahad: paymentIntentId },
          })
          console.log(`✅ Updated database for student ${student.id}`)
        }

        successCount++
      } catch (error: any) {
        console.error(
          `❌ Error processing student ${student.id}:`,
          error.message
        )
        failureCount++
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`)
    console.log('📊 SUMMARY')
    console.log('='.repeat(80))
    console.log(`✅ Successfully processed: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)
    console.log(`📝 Total updates: ${updates.length}`)

    if (dryRun) {
      console.log(`\n⚠️  DRY RUN - No changes made to database`)
      console.log(`Run with --apply flag to apply changes`)
    } else {
      console.log(`\n✅ Database updated successfully!`)
    }

    // Show detailed update list if not too many
    if (updates.length > 0 && updates.length <= 10) {
      console.log(`\n📋 Updates that ${dryRun ? 'would be' : 'were'} applied:`)
      updates.forEach((update, i) => {
        console.log(
          `${i + 1}. ${update.name} - ${update.paymentIntentId.slice(0, 20)}...`
        )
      })
    }
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line args
const args = process.argv.slice(2)
const dryRun = !args.includes('--apply')

backfillPaymentIntents(dryRun)
