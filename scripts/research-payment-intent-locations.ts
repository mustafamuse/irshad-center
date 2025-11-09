/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Research Script: PaymentIntent Location Analysis
 *
 * This script queries real Stripe subscriptions to understand where PaymentIntent
 * information lives and how it differs between instant verification and microdeposit flows.
 *
 * Usage:
 *   NODE_ENV=production npx tsx --env-file=.env.local scripts/research-payment-intent-locations.ts
 */

import { PrismaClient } from '@prisma/client'
import { getStripeClient } from '../lib/stripe'

const prisma = new PrismaClient()
const stripe = getStripeClient()

interface ResearchResult {
  studentName: string
  studentId: string
  subscriptionId: string
  customerId: string
  subscriptionStatus: string
  paymentMethodType: string | null
  verificationMethod: string | null

  // PaymentIntent locations
  subscriptionLatestInvoicePI: string | null
  firstInvoicePI: string | null
  latestInvoicePI: string | null

  // Additional context
  firstInvoiceBillingReason: string | null
  totalInvoiceCount: number
  bankVerificationStatus: string | null

  // Raw data samples
  subscriptionSample: any
  firstInvoiceSample: any
  paymentMethodSample: any
}

async function researchPaymentIntentLocations() {
  console.log('🔬 PaymentIntent Location Research')
  console.log('='.repeat(80))
  console.log('\n')

  const results: ResearchResult[] = []

  try {
    // Target subscriptions for research
    const targetSubscriptions = [
      {
        name: 'Zuhra Malim',
        subscriptionId: 'sub_1SOKwhFsdFzP1bzTM1twzQjN',
        type: 'Instant Verification',
      },
      {
        name: 'Ebyan Hassan',
        subscriptionId: 'sub_1SF4RtFsdFzP1bzTKiAazgWr',
        type: 'Microdeposit Verification',
      },
    ]

    for (const target of targetSubscriptions) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🎯 Researching: ${target.name} (${target.type})`)
      console.log(`Subscription ID: ${target.subscriptionId}`)
      console.log('='.repeat(80))

      const result: ResearchResult = {
        studentName: target.name,
        studentId: '',
        subscriptionId: target.subscriptionId,
        customerId: '',
        subscriptionStatus: '',
        paymentMethodType: null,
        verificationMethod: null,
        subscriptionLatestInvoicePI: null,
        firstInvoicePI: null,
        latestInvoicePI: null,
        firstInvoiceBillingReason: null,
        totalInvoiceCount: 0,
        bankVerificationStatus: null,
        subscriptionSample: null,
        firstInvoiceSample: null,
        paymentMethodSample: null,
      }

      try {
        // ===================================================================
        // STEP 1: Retrieve Subscription with Full Expansions
        // ===================================================================
        console.log('\n📡 Step 1: Retrieving subscription with expansions...')
        const subscription = await stripe.subscriptions.retrieve(
          target.subscriptionId,
          {
            expand: [
              'default_payment_method',
              'latest_invoice',
              'latest_invoice.payment_intent',
              'pending_setup_intent',
            ],
          }
        )

        result.customerId = subscription.customer as string
        result.subscriptionStatus = subscription.status

        console.log(`   ✅ Status: ${subscription.status}`)
        console.log(`   ✅ Customer: ${result.customerId}`)

        // Check latest_invoice for PaymentIntent
        const latestInvoice = subscription.latest_invoice as any
        if (latestInvoice) {
          const piFromLatest =
            typeof latestInvoice.payment_intent === 'string'
              ? latestInvoice.payment_intent
              : latestInvoice.payment_intent?.id || null

          result.subscriptionLatestInvoicePI = piFromLatest
          result.latestInvoicePI = piFromLatest

          console.log(`   📄 Latest Invoice: ${latestInvoice.id}`)
          console.log(`   💳 PaymentIntent on latest_invoice: ${piFromLatest || 'NULL'}`)
        } else {
          console.log(`   ⚠️  No latest_invoice`)
        }

        // Check payment method
        const paymentMethod = subscription.default_payment_method as any
        if (paymentMethod) {
          result.paymentMethodType = paymentMethod.type
          console.log(`   💰 Payment Method Type: ${paymentMethod.type}`)

          if (paymentMethod.type === 'us_bank_account') {
            const bankAccount = paymentMethod.us_bank_account
            result.bankVerificationStatus =
              bankAccount.status_details?.blocked?.reason ||
              bankAccount.networks?.preferred ||
              'unknown'
            result.verificationMethod = bankAccount.financial_connections_account
              ? 'instant (Financial Connections)'
              : 'microdeposits'

            console.log(`   🏦 Bank: ${bankAccount.bank_name} ****${bankAccount.last4}`)
            console.log(`   🔒 Verification Method: ${result.verificationMethod}`)
            console.log(`   ✓ Verification Status: ${result.bankVerificationStatus}`)

            // Save payment method sample
            result.paymentMethodSample = {
              type: paymentMethod.type,
              us_bank_account: {
                bank_name: bankAccount.bank_name,
                last4: bankAccount.last4,
                account_type: bankAccount.account_type,
                routing_number: bankAccount.routing_number,
                status_details: bankAccount.status_details,
                networks: bankAccount.networks,
                financial_connections_account: bankAccount.financial_connections_account,
              },
            }
          }
        }

        // Save subscription sample (limited fields)
        result.subscriptionSample = {
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          created: subscription.created,
          latest_invoice: latestInvoice ? {
            id: latestInvoice.id,
            status: latestInvoice.status,
            billing_reason: latestInvoice.billing_reason,
            payment_intent: result.subscriptionLatestInvoicePI,
          } : null,
          pending_setup_intent: subscription.pending_setup_intent,
        }

        // ===================================================================
        // STEP 2: Retrieve ALL Invoices
        // ===================================================================
        console.log('\n📡 Step 2: Retrieving all invoices...')
        const invoices = await stripe.invoices.list({
          subscription: target.subscriptionId,
          limit: 100,
          expand: ['data.payment_intent'],
        })

        result.totalInvoiceCount = invoices.data.length
        console.log(`   ✅ Found ${invoices.data.length} invoices`)

        // Sort by creation date (oldest first)
        const sortedInvoices = invoices.data.sort((a, b) => a.created - b.created)

        // Display all invoices
        console.log('\n   📋 Invoice History:')
        sortedInvoices.forEach((inv, index) => {
          const pi =
            typeof inv.payment_intent === 'string'
              ? inv.payment_intent
              : (inv.payment_intent as any)?.id || null

          console.log(
            `      ${index + 1}. ${inv.id} | ${inv.billing_reason?.padEnd(20)} | ${inv.status.padEnd(10)} | PI: ${pi || 'NULL'}`
          )
        })

        // ===================================================================
        // STEP 3: Find First Invoice (subscription_create)
        // ===================================================================
        console.log('\n📡 Step 3: Analyzing first invoice (subscription_create)...')
        const firstInvoice = sortedInvoices.find(
          (inv) => inv.billing_reason === 'subscription_create'
        )

        if (firstInvoice) {
          const piFromFirst =
            typeof firstInvoice.payment_intent === 'string'
              ? firstInvoice.payment_intent
              : (firstInvoice.payment_intent as any)?.id || null

          result.firstInvoicePI = piFromFirst
          result.firstInvoiceBillingReason = firstInvoice.billing_reason

          console.log(`   ✅ First Invoice: ${firstInvoice.id}`)
          console.log(`   ✅ Billing Reason: ${firstInvoice.billing_reason}`)
          console.log(`   ✅ Status: ${firstInvoice.status}`)
          console.log(`   💳 PaymentIntent: ${piFromFirst || 'NULL'}`)

          // Save first invoice sample
          result.firstInvoiceSample = {
            id: firstInvoice.id,
            status: firstInvoice.status,
            billing_reason: firstInvoice.billing_reason,
            payment_intent: piFromFirst,
            created: firstInvoice.created,
            amount_due: firstInvoice.amount_due,
          }

          // If PaymentIntent exists, retrieve its details
          if (piFromFirst) {
            console.log('\n📡 Step 3a: Retrieving PaymentIntent details...')
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(piFromFirst)
              console.log(`   ✅ PaymentIntent Status: ${paymentIntent.status}`)
              console.log(`   ✅ Payment Method: ${paymentIntent.payment_method || 'NULL'}`)
              console.log(`   ✅ Amount: $${(paymentIntent.amount / 100).toFixed(2)}`)

              if (paymentIntent.next_action) {
                console.log(`   ⚠️  Requires Action: ${paymentIntent.next_action.type}`)
              }
            } catch (error: any) {
              console.log(`   ❌ Error retrieving PaymentIntent: ${error.message}`)
            }
          }
        } else {
          console.log(`   ⚠️  No subscription_create invoice found`)
        }

        // ===================================================================
        // STEP 4: Check Database
        // ===================================================================
        console.log('\n📡 Step 4: Checking database...')
        const student = await prisma.student.findFirst({
          where: {
            program: 'MAHAD_PROGRAM',
            stripeSubscriptionId: target.subscriptionId,
          },
          select: {
            id: true,
            name: true,
            paymentIntentIdMahad: true,
            subscriptionStatus: true,
          },
        })

        if (student) {
          result.studentId = student.id
          console.log(`   ✅ Found student: ${student.name} (${student.id})`)
          console.log(`   💾 Database PaymentIntent: ${student.paymentIntentIdMahad || 'NULL'}`)
          console.log(`   💾 Database Status: ${student.subscriptionStatus || 'NULL'}`)

          // Compare database with Stripe
          if (student.paymentIntentIdMahad !== result.firstInvoicePI) {
            console.log(`   ⚠️  MISMATCH: Database PI != First Invoice PI`)
          }
          if (student.paymentIntentIdMahad !== result.latestInvoicePI) {
            console.log(`   ⚠️  MISMATCH: Database PI != Latest Invoice PI`)
          }
        } else {
          console.log(`   ⚠️  Student not found in database`)
        }

        // ===================================================================
        // SUMMARY
        // ===================================================================
        console.log('\n📊 Summary:')
        console.log(`   Payment Method: ${result.paymentMethodType}`)
        console.log(`   Verification: ${result.verificationMethod}`)
        console.log(`   Total Invoices: ${result.totalInvoiceCount}`)
        console.log(`   First Invoice PI: ${result.firstInvoicePI || 'NULL'}`)
        console.log(`   Latest Invoice PI: ${result.latestInvoicePI || 'NULL'}`)
        console.log(`   Match: ${result.firstInvoicePI === result.latestInvoicePI ? 'YES' : 'NO'}`)

        results.push(result)
      } catch (error: any) {
        console.error(`\n❌ Error researching ${target.name}:`, error.message)
      }
    }

    // ===================================================================
    // FINAL REPORT
    // ===================================================================
    console.log(`\n\n${'='.repeat(80)}`)
    console.log('📊 RESEARCH FINDINGS')
    console.log('='.repeat(80))

    console.log('\n## PaymentIntent Location Analysis\n')

    results.forEach((r, i) => {
      console.log(`### ${i + 1}. ${r.studentName}`)
      console.log(`- **Subscription ID**: ${r.subscriptionId}`)
      console.log(`- **Status**: ${r.subscriptionStatus}`)
      console.log(`- **Payment Method**: ${r.paymentMethodType}`)
      console.log(`- **Verification Method**: ${r.verificationMethod}`)
      console.log(`- **First Invoice PaymentIntent**: ${r.firstInvoicePI || 'NULL'}`)
      console.log(`- **Latest Invoice PaymentIntent**: ${r.latestInvoicePI || 'NULL'}`)
      console.log(`- **Match**: ${r.firstInvoicePI === r.latestInvoicePI ? 'YES ✅' : 'NO ❌'}`)
      console.log(`- **Total Invoices**: ${r.totalInvoiceCount}`)
      console.log('')
    })

    console.log('\n## Key Insights\n')

    // Analyze patterns
    const instantVerificationResults = results.filter(
      (r) => r.verificationMethod?.includes('instant')
    )
    const microdepositResults = results.filter((r) =>
      r.verificationMethod?.includes('microdeposits')
    )

    console.log(`### Instant Verification (${instantVerificationResults.length} subscriptions):`)
    instantVerificationResults.forEach((r) => {
      console.log(
        `- ${r.studentName}: First PI = ${r.firstInvoicePI ? 'EXISTS' : 'NULL'}, Latest PI = ${r.latestInvoicePI ? 'EXISTS' : 'NULL'}`
      )
    })

    console.log(`\n### Microdeposit Verification (${microdepositResults.length} subscriptions):`)
    microdepositResults.forEach((r) => {
      console.log(
        `- ${r.studentName}: First PI = ${r.firstInvoicePI ? 'EXISTS' : 'NULL'}, Latest PI = ${r.latestInvoicePI ? 'EXISTS' : 'NULL'}`
      )
    })

    console.log('\n## Recommendations\n')

    const allHaveFirstInvoicePI = results.every((r) => r.firstInvoicePI !== null)
    const allHaveLatestInvoicePI = results.every((r) => r.latestInvoicePI !== null)
    const firstMatchesLatest = results.every(
      (r) => r.firstInvoicePI === r.latestInvoicePI
    )

    if (allHaveFirstInvoicePI) {
      console.log(
        '✅ **All subscriptions have PaymentIntent on first (subscription_create) invoice**'
      )
    } else {
      console.log(
        '⚠️  **Some subscriptions are missing PaymentIntent on first invoice**'
      )
    }

    if (firstMatchesLatest) {
      console.log('✅ **First invoice PaymentIntent matches latest invoice PaymentIntent**')
      console.log(
        '   → Safe to use either first or latest invoice for backfill'
      )
    } else {
      console.log('⚠️  **First and latest invoice PaymentIntents differ**')
      console.log(
        '   → Should use first (subscription_create) invoice for consistency with webhook'
      )
    }

    console.log('\n### Webhook Strategy:')
    console.log('1. ✅ Listen to `invoice.finalized` event')
    console.log('2. ✅ Filter for `billing_reason === "subscription_create"`')
    console.log('3. ✅ Extract PaymentIntent from `invoice.payment_intent`')
    console.log('4. ✅ Update student record by `stripeSubscriptionId`')

    console.log('\n### Backfill Strategy:')
    if (allHaveFirstInvoicePI) {
      console.log('1. ✅ Query all invoices for each subscription')
      console.log('2. ✅ Find first invoice with `billing_reason === "subscription_create"`')
      console.log('3. ✅ Extract PaymentIntent from invoice')
      console.log('4. ✅ Update student records')
    } else {
      console.log('1. ⚠️  Check both first and latest invoices')
      console.log('2. ⚠️  Prefer first invoice if available')
      console.log('3. ⚠️  Fallback to latest invoice if first is null')
      console.log('4. ⚠️  Log cases where neither has PaymentIntent')
    }

    console.log('\n## Sample Data\n')
    console.log('(Check JSON samples for detailed structure)')
    console.log('\n')

    // Output JSON samples
    results.forEach((r) => {
      console.log(`\n### ${r.studentName} - Sample Data`)
      console.log('\n**First Invoice Sample:**')
      console.log(JSON.stringify(r.firstInvoiceSample, null, 2))

      console.log('\n**Payment Method Sample:**')
      console.log(JSON.stringify(r.paymentMethodSample, null, 2))
    })
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the research
researchPaymentIntentLocations()
