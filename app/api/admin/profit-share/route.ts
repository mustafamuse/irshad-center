import { NextResponse } from 'next/server'

import type Stripe from 'stripe'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { stripeServerClient } from '@/lib/stripe'

// Schema validation
const requestSchema = z.object({
  year: z
    .number()
    .int()
    .min(2020)
    .max(new Date().getFullYear() + 1),
  month: z.number().int().min(1).max(12),
  batchIds: z.array(z.string()).optional(),
})

// Types
interface ExcludedCharge {
  studentName: string
  studentEmail: string
  customerEmail: string
  chargeAmount: number
  chargeId: string
  invoiceId: string | null
  payoutId: string
  customerId: string
}

interface StudentInfo {
  studentName: string
  studentEmail: string
  customerEmail: string
  chargesFound: number
  batchId: string
  customerId: string
}

// Helper functions
async function getStudentsInBatches(batchIds: string[]) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return []
}

async function getStudentsWithSubscriptions(batchIds: string[]) {
  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  return []
}

async function getCustomerEmailFromSubscription(student: {
  stripeSubscriptionId: string | null
  email: string | null
  name: string
  batchId: string | null
}) {
  if (!student.stripeSubscriptionId || !student.email) return null

  try {
    const subscription = await stripeServerClient.subscriptions.retrieve(
      student.stripeSubscriptionId,
      { expand: ['customer'] }
    )

    const customer = subscription.customer as Stripe.Customer
    return customer.email
      ? {
          customerEmail: customer.email,
          studentName: student.name || student.email,
          studentEmail: student.email,
          batchId: student.batchId ?? '',
          customerId: customer.id,
        }
      : null
  } catch (error) {
    console.error(
      `Failed to retrieve subscription for ${student.email}:`,
      error
    )
    return null
  }
}

async function processPayouts(
  startDate: Date,
  endDate: Date,
  emailsToExclude: string[],
  studentEmailToInfo: Record<
    string,
    {
      studentName: string
      studentEmail: string
      batchId: string
      customerId: string
    }
  >
) {
  let totalPayoutAmount = 0
  let totalDeductions = 0
  let payoutsFoundCount = 0
  const excludedCharges: ExcludedCharge[] = []

  const payoutParams: Stripe.PayoutListParams = {
    arrival_date: {
      gte: Math.floor(startDate.getTime() / 1000),
      lt: Math.floor(endDate.getTime() / 1000),
    },
    status: 'paid',
    limit: 100,
  }

  for await (const payout of stripeServerClient.payouts.list(payoutParams)) {
    payoutsFoundCount++
    totalPayoutAmount += payout.amount

    const balanceTransactions =
      await stripeServerClient.balanceTransactions.list({
        payout: payout.id,
        limit: 100,
        expand: ['data.source.customer'],
      })

    for (const txn of balanceTransactions.data) {
      if (txn.reporting_category === 'charge') {
        const charge = txn.source as Stripe.Charge
        if (charge.customer && charge.paid === true) {
          const customer = charge.customer as Stripe.Customer
          const customerEmail = customer.email

          if (customerEmail && emailsToExclude.includes(customerEmail)) {
            const studentInfo = studentEmailToInfo[customerEmail]
            totalDeductions += txn.net

            excludedCharges.push({
              studentName: studentInfo.studentName,
              studentEmail: studentInfo.studentEmail,
              customerEmail: customerEmail,
              chargeAmount: txn.net,
              chargeId: charge.id,
              invoiceId: (charge as any).invoice || null,
              payoutId: payout.id,
              customerId: customer.id,
            })
          }
        }
      }
    }
  }

  return {
    totalPayoutAmount,
    totalDeductions,
    payoutsFoundCount,
    excludedCharges,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 }
      )
    }

    const { year, month, batchIds = [] } = validation.data
    const emailsToExclude: string[] = []
    const exclusionLog: Record<string, StudentInfo> = {}
    const studentEmailToInfo: Record<
      string,
      {
        studentName: string
        studentEmail: string
        batchId: string
        customerId: string
      }
    > = {}

    // Get all students in selected batches
    const allStudentsInBatches = await getStudentsInBatches(batchIds)
    const studentsWithSubscriptions =
      await getStudentsWithSubscriptions(batchIds)

    // Process student subscriptions
    const customerEmailPromises = studentsWithSubscriptions.map(
      getCustomerEmailFromSubscription
    )
    const customerEmails = await Promise.all(customerEmailPromises)

    customerEmails.forEach((result) => {
      if (result) {
        const {
          customerEmail,
          studentName,
          studentEmail,
          batchId,
          customerId,
        } = result
        studentEmailToInfo[customerEmail] = {
          studentName,
          studentEmail,
          batchId,
          customerId,
        }
        emailsToExclude.push(customerEmail)
        exclusionLog[customerEmail] = {
          studentName,
          studentEmail,
          customerEmail,
          chargesFound: 0,
          batchId,
          customerId,
        }
      }
    })

    // TODO: Add missing students to exclusionLog - Migration needed
    // allStudentsInBatches.forEach((student) => { ... })

    // Process payouts
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 1))

    const {
      totalPayoutAmount,
      totalDeductions,
      payoutsFoundCount,
      excludedCharges,
    } = await processPayouts(
      startDate,
      endDate,
      emailsToExclude,
      studentEmailToInfo
    )

    // Update chargesFound count in exclusionLog
    excludedCharges.forEach((charge) => {
      if (exclusionLog[charge.customerEmail]) {
        exclusionLog[charge.customerEmail].chargesFound++
      }
    })

    return NextResponse.json({
      totalPayoutAmount,
      totalDeductions,
      finalAdjustedPayout: totalPayoutAmount - totalDeductions,
      payoutsFound: payoutsFoundCount,
      excludedCharges,
      exclusionSummary: Object.values(exclusionLog),
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred'
    console.error(`[PROFIT_SHARE_API_ERROR]`, errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
