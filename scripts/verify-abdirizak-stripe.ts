/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Verify Abdirizak Hassan's Subscription Status
 * Checks both Prisma database AND Stripe to find discrepancies
 * READ ONLY - no database changes
 */
import { PrismaClient } from '@prisma/client'

import { getDugsiStripeClient } from '../lib/stripe-dugsi'

const prisma = new PrismaClient()

async function verifyAbdirizak() {
  console.log('🔍 Verifying Abdirizak Hassan family status...\n')
  console.log('='.repeat(80))

  try {
    // Find the student in database
    const student = await prisma.student.findUnique({
      where: { id: '778d32ff-3eec-4fa5-8592-0c504ab0a81c' },
      select: {
        id: true,
        name: true,
        parentEmail: true,
        parentFirstName: true,
        parentLastName: true,
        stripeCustomerIdDugsi: true,
        stripeSubscriptionIdDugsi: true,
        subscriptionStatus: true,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: true,
        paymentIntentIdDugsi: true,
        paidUntil: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        status: true,
      },
    })

    if (!student) {
      console.log('❌ Student not found in database')
      return
    }

    console.log('\n📋 DATABASE RECORD:')
    console.log('='.repeat(80))
    console.log(`Student: ${student.name}`)
    console.log(`Parent: ${student.parentFirstName} ${student.parentLastName}`)
    console.log(`Email: ${student.parentEmail}`)
    console.log()
    console.log('Database Fields:')
    console.log(
      `  stripeCustomerIdDugsi: ${student.stripeCustomerIdDugsi || 'NULL'}`
    )
    console.log(
      `  stripeSubscriptionIdDugsi: ${student.stripeSubscriptionIdDugsi || 'NULL'}`
    )
    console.log(
      `  paymentIntentIdDugsi: ${student.paymentIntentIdDugsi || 'NULL'}`
    )
    console.log(`  subscriptionStatus: ${student.subscriptionStatus || 'NULL'}`)
    console.log(`  paymentMethodCaptured: ${student.paymentMethodCaptured}`)
    console.log(
      `  paymentMethodCapturedAt: ${student.paymentMethodCapturedAt?.toISOString() || 'NULL'}`
    )
    console.log(`  paidUntil: ${student.paidUntil?.toISOString() || 'NULL'}`)
    console.log(`  status: ${student.status}`)

    // Now check Stripe
    console.log('\n\n🔗 STRIPE DATA:')
    console.log('='.repeat(80))

    const stripe = getDugsiStripeClient()

    // Check customer
    if (student.stripeCustomerIdDugsi) {
      try {
        const customer = await stripe.customers.retrieve(
          student.stripeCustomerIdDugsi
        )
        console.log('\n✅ Customer found in Stripe:')
        console.log(`  ID: ${customer.id}`)
        console.log(`  Email: ${(customer as any).email || 'N/A'}`)
        console.log(
          `  Created: ${new Date((customer as any).created * 1000).toISOString()}`
        )
      } catch (error: any) {
        console.log(`\n❌ Customer NOT found in Stripe: ${error.message}`)
      }
    } else {
      console.log('\n⚠️  No customer ID in database')
    }

    // Check subscription
    if (student.stripeSubscriptionIdDugsi) {
      try {
        const subscription: any = await stripe.subscriptions.retrieve(
          student.stripeSubscriptionIdDugsi
        )
        console.log('\n✅ Subscription found in Stripe:')
        console.log(`  ID: ${subscription.id}`)
        console.log(`  Status: ${subscription.status}`)
        console.log(`  Customer: ${subscription.customer}`)
        console.log(
          `  Created: ${new Date(subscription.created * 1000).toISOString()}`
        )
        console.log(
          `  Current Period Start: ${new Date(subscription.current_period_start * 1000).toISOString()}`
        )
        console.log(
          `  Current Period End: ${new Date(subscription.current_period_end * 1000).toISOString()}`
        )
        console.log(
          `  Cancel At Period End: ${subscription.cancel_at_period_end}`
        )
        console.log(
          `  Canceled At: ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : 'N/A'}`
        )

        // Check payment method
        if (subscription.default_payment_method) {
          const pmId =
            typeof subscription.default_payment_method === 'string'
              ? subscription.default_payment_method
              : subscription.default_payment_method.id

          try {
            const pm = await stripe.paymentMethods.retrieve(pmId)
            console.log('\n💳 Payment Method:')
            console.log(`  Type: ${pm.type}`)
            if (pm.type === 'us_bank_account') {
              console.log(
                `  Bank: ${(pm as any).us_bank_account?.bank_name || 'N/A'}`
              )
              console.log(
                `  Last 4: ****${(pm as any).us_bank_account?.last4 || 'N/A'}`
              )
              console.log(
                `  Status: ${(pm as any).us_bank_account?.status_details?.blocked?.reason || 'verified'}`
              )
            }
          } catch (error: any) {
            console.log(`\n❌ Payment method error: ${error.message}`)
          }
        }

        // Compare database vs Stripe
        console.log('\n\n🔍 COMPARISON:')
        console.log('='.repeat(80))
        const dbStatus = student.subscriptionStatus || 'NULL'
        const stripeStatus = subscription.status

        if (dbStatus !== stripeStatus) {
          console.log(`⚠️  STATUS MISMATCH:`)
          console.log(`   Database: "${dbStatus}"`)
          console.log(`   Stripe:   "${stripeStatus}"`)
        } else {
          console.log(`✅ Status matches: ${dbStatus}`)
        }
      } catch (error: any) {
        console.log(`\n❌ Subscription NOT found in Stripe: ${error.message}`)
        console.log('\n⚠️  CRITICAL ISSUE:')
        console.log('   Database has subscription ID but Stripe does not!')
        console.log('   This is stale/invalid data.')
      }
    } else {
      console.log('\n⚠️  No subscription ID in database')
    }

    console.log('\n\n🎯 FINAL DETERMINATION:')
    console.log('='.repeat(80))

    const hasValidSubscription =
      student.stripeSubscriptionIdDugsi &&
      student.subscriptionStatus === 'active'
    const isPendingSetup =
      student.paymentMethodCaptured && !hasValidSubscription
    const needsPaymentIntentId = isPendingSetup && !student.paymentIntentIdDugsi

    console.log(`Has payment captured: ${student.paymentMethodCaptured}`)
    console.log(`Has valid active subscription: ${hasValidSubscription}`)
    console.log(`Should be in "Pending Setup": ${isPendingSetup}`)
    console.log(`Missing PaymentIntent ID: ${needsPaymentIntentId}`)
    console.log()

    if (needsPaymentIntentId) {
      console.log('✅ CONCLUSION: User is CORRECT')
      console.log(
        '   This family should be counted with the other 4 pending families.'
      )
      console.log('   Total families needing PaymentIntent ID: 5 (not 4)')
    } else if (!isPendingSetup) {
      console.log('✅ CONCLUSION: Script was CORRECT')
      console.log('   This family has an active subscription.')
    } else {
      console.log('⚠️  CONCLUSION: Has PaymentIntent ID')
      console.log(
        '   This family is pending but already has the required field.'
      )
    }
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyAbdirizak()
  .then(() => {
    console.log('\n✅ Verification complete!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
