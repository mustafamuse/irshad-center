/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Verify Mahad Student Stripe Data
 *
 * This script checks the Stripe production data for Mahad students to verify:
 * - Payment method types (ACH vs Card)
 * - PaymentIntent locations (first invoice vs latest)
 * - Bank account verification status
 * - Data consistency between database and Stripe
 */

import { PrismaClient } from '@prisma/client'
import { getStripeClient } from '../lib/stripe'

const prisma = new PrismaClient()
const stripe = getStripeClient()

interface VerificationResult {
  studentId: string
  name: string
  subscriptionId: string
  subscriptionStatus: string
  paymentMethodType: string | null
  paymentMethodDetails: string
  bankVerificationStatus: string | null
  firstInvoicePaymentIntent: string | null
  latestInvoicePaymentIntent: string | null
  needsVerification: boolean
  issues: string[]
}

async function verifyStripeData() {
  console.log('🔍 Verifying Mahad Student Stripe Data...\n')
  console.log('='.repeat(80))

  const results: VerificationResult[] = []

  try {
    // Find all Mahad students with subscriptions
    const students = await prisma.student.findMany({
      where: {
        program: 'MAHAD_PROGRAM',
        stripeSubscriptionId: { not: null },
      },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        paymentIntentIdMahad: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    console.log(`📊 Found ${students.length} Mahad students with subscriptions\n`)

    for (let index = 0; index < students.length; index++) {
      const student = students[index]
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Student ${index + 1}/${students.length}: ${student.name}`)
      console.log('='.repeat(80))

      const result: VerificationResult = {
        studentId: student.id,
        name: student.name,
        subscriptionId: student.stripeSubscriptionId!,
        subscriptionStatus: '',
        paymentMethodType: null,
        paymentMethodDetails: '',
        bankVerificationStatus: null,
        firstInvoicePaymentIntent: null,
        latestInvoicePaymentIntent: null,
        needsVerification: false,
        issues: [],
      }

      try {
        // 1. Get subscription details
        const subscription = await stripe.subscriptions.retrieve(
          student.stripeSubscriptionId!,
          {
            expand: [
              'default_payment_method',
              'latest_invoice',
              'latest_invoice.payment_intent'
            ],
          }
        )

        result.subscriptionStatus = subscription.status
        console.log(`✅ Subscription Status: ${subscription.status}`)

        // 2. Check payment method
        const paymentMethod = subscription.default_payment_method as any
        if (paymentMethod) {
          result.paymentMethodType = paymentMethod.type
          console.log(`💳 Payment Method Type: ${paymentMethod.type}`)

          if (paymentMethod.type === 'us_bank_account') {
            const bankAccount = paymentMethod.us_bank_account
            result.paymentMethodDetails = `${bankAccount.bank_name} - ${bankAccount.account_type} (****${bankAccount.last4})`
            result.bankVerificationStatus = bankAccount.status_details?.blocked?.reason || bankAccount.networks?.preferred || 'unknown'
            result.needsVerification = bankAccount.status_details?.blocked?.reason === 'needs_micro_deposit_verification'

            console.log(`🏦 Bank: ${result.paymentMethodDetails}`)
            console.log(`🔒 Verification Status: ${result.bankVerificationStatus}`)
          } else if (paymentMethod.type === 'card') {
            const card = paymentMethod.card
            result.paymentMethodDetails = `${card.brand} ****${card.last4} (exp: ${card.exp_month}/${card.exp_year})`
            console.log(`💳 Card: ${result.paymentMethodDetails}`)
          } else {
            result.paymentMethodDetails = paymentMethod.type
            console.log(`💰 Payment Method: ${paymentMethod.type}`)
          }
        } else {
          console.log(`⚠️  No default payment method`)
          result.issues.push('No default payment method')
        }

        // 3. Check latest invoice for PaymentIntent
        const latestInvoice = subscription.latest_invoice as any
        if (latestInvoice?.payment_intent) {
          const piId = typeof latestInvoice.payment_intent === 'string'
            ? latestInvoice.payment_intent
            : latestInvoice.payment_intent.id
          result.latestInvoicePaymentIntent = piId
          console.log(`📄 Latest Invoice PaymentIntent: ${piId}`)
        }

        // 4. Get first invoice (subscription_create) for PaymentIntent
        console.log(`\n🔎 Checking first invoice...`)
        const invoices = await stripe.invoices.list({
          subscription: student.stripeSubscriptionId!,
          limit: 100,
          expand: ['data.payment_intent']
        })

        // Find the subscription_create invoice
        const firstInvoice = invoices.data
          .sort((a, b) => a.created - b.created)
          .find(inv => inv.billing_reason === 'subscription_create')

        if ((firstInvoice as any)?.payment_intent) {
          const piId = typeof (firstInvoice as any).payment_intent === 'string'
            ? (firstInvoice as any).payment_intent
            : (firstInvoice as any).payment_intent.id
          result.firstInvoicePaymentIntent = piId
          console.log(`📄 First Invoice PaymentIntent: ${piId}`)
        } else {
          console.log(`⚠️  No PaymentIntent on first invoice`)
          result.issues.push('No PaymentIntent on first invoice')
        }

        // 5. Compare with database
        if (student.paymentIntentIdMahad) {
          console.log(`💾 Database PaymentIntent: ${student.paymentIntentIdMahad}`)

          // Check if it matches either first or latest
          if (student.paymentIntentIdMahad !== result.firstInvoicePaymentIntent &&
              student.paymentIntentIdMahad !== result.latestInvoicePaymentIntent) {
            result.issues.push('Database PaymentIntent does not match Stripe')
          }
        } else {
          console.log(`💾 Database PaymentIntent: NULL`)
        }

        // 6. Determine if verification is needed
        if (result.paymentMethodType === 'us_bank_account' &&
            result.subscriptionStatus === 'incomplete' &&
            !student.paymentIntentIdMahad) {
          result.needsVerification = true
          console.log(`\n⚠️  NEEDS BANK VERIFICATION`)
        }

      } catch (error: any) {
        console.error(`❌ Error: ${error.message}`)
        result.issues.push(error.message)
      }

      results.push(result)
    }

    // Generate summary report
    console.log(`\n\n${'='.repeat(80)}`)
    console.log('📊 VERIFICATION SUMMARY')
    console.log('='.repeat(80))

    const byPaymentType = results.reduce((acc, r) => {
      const type = r.paymentMethodType || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n💳 Payment Method Distribution:')
    Object.entries(byPaymentType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} students`)
    })

    const needingVerification = results.filter(r => r.needsVerification)
    console.log(`\n🔒 Students Needing Bank Verification: ${needingVerification.length}`)

    const withIssues = results.filter(r => r.issues.length > 0)
    console.log(`\n⚠️  Students with Issues: ${withIssues.length}`)

    if (withIssues.length > 0) {
      console.log('\nIssues Breakdown:')
      withIssues.forEach(r => {
        console.log(`  - ${r.name}: ${r.issues.join(', ')}`)
      })
    }

    const withFirstInvoicePI = results.filter(r => r.firstInvoicePaymentIntent)
    const withLatestInvoicePI = results.filter(r => r.latestInvoicePaymentIntent)

    console.log(`\n📄 PaymentIntent Locations:`)
    console.log(`  - First Invoice: ${withFirstInvoicePI.length} students`)
    console.log(`  - Latest Invoice: ${withLatestInvoicePI.length} students`)

    // Detailed breakdown by status
    const byStatus = results.reduce((acc, r) => {
      acc[r.subscriptionStatus] = (acc[r.subscriptionStatus] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n📈 Subscription Status Distribution:')
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} students`)
    })

    // Bank accounts needing verification
    const bankAccounts = results.filter(r => r.paymentMethodType === 'us_bank_account')
    if (bankAccounts.length > 0) {
      console.log(`\n\n${'='.repeat(80)}`)
      console.log('🏦 BANK ACCOUNT DETAILS')
      console.log('='.repeat(80))

      bankAccounts.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.name}`)
        console.log(`   Status: ${r.subscriptionStatus}`)
        console.log(`   Bank: ${r.paymentMethodDetails}`)
        console.log(`   Verification: ${r.bankVerificationStatus}`)
        console.log(`   First Invoice PI: ${r.firstInvoicePaymentIntent || 'None'}`)
        console.log(`   Latest Invoice PI: ${r.latestInvoicePaymentIntent || 'None'}`)
        console.log(`   Needs Verification: ${r.needsVerification ? 'YES' : 'NO'}`)
      })
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyStripeData()
