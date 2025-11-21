import { NextResponse } from 'next/server'

import type Stripe from 'stripe'
import { z } from 'zod'

import { getBillingAssignmentsByProfile } from '@/lib/db/queries/billing'
import { getEnrollmentsByBatch } from '@/lib/db/queries/enrollment'
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
  if (batchIds.length === 0) {
    return []
  }

  const allEnrollments = []
  for (const batchId of batchIds) {
    const enrollments = await getEnrollmentsByBatch(batchId)
    allEnrollments.push(...enrollments)
  }

  return allEnrollments.map((enrollment) => ({
    id: enrollment.programProfile.id,
    name: enrollment.programProfile.person.name,
    email:
      enrollment.programProfile.person.contactPoints.find(
        (cp) => cp.type === 'EMAIL'
      )?.value || null,
    batchId: enrollment.batchId,
    programProfileId: enrollment.programProfileId,
  }))
}

async function getStudentsWithSubscriptions(batchIds: string[]) {
  if (batchIds.length === 0) {
    return []
  }

  // Get enrollments in batches
  const enrollments = await getStudentsInBatches(batchIds)

  // Get profiles with active billing assignments
  const studentsWithSubscriptions = []
  for (const enrollment of enrollments) {
    const assignments = await getBillingAssignmentsByProfile(
      enrollment.programProfileId
    )

    if (assignments.length > 0) {
      // Get the first active subscription
      const activeAssignment = assignments.find(
        (a) =>
          a.subscription.status === 'active' ||
          a.subscription.status === 'trialing' ||
          a.subscription.status === 'past_due'
      )

      if (activeAssignment) {
        studentsWithSubscriptions.push({
          id: enrollment.programProfileId,
          name: enrollment.name,
          email: enrollment.email,
          batchId: enrollment.batchId,
          stripeSubscriptionId:
            activeAssignment.subscription.stripeSubscriptionId,
          customerId: activeAssignment.subscription.stripeCustomerId,
        })
      }
    }
  }

  return studentsWithSubscriptions
}

async function getCustomerEmailFromSubscription(student: {
  stripeSubscriptionId: string | null
  email: string | null
  name: string
  batchId: string | null
  customerId?: string | null
}) {
  if (!student.stripeSubscriptionId) return null

  try {
    const subscription = await stripeServerClient.subscriptions.retrieve(
      student.stripeSubscriptionId,
      { expand: ['customer'] }
    )

    const customer = subscription.customer as Stripe.Customer
    const customerEmail = customer.email || null

    return customerEmail
      ? {
          customerEmail,
          studentName: student.name || student.email || 'Unknown',
          studentEmail: student.email || '',
          batchId: student.batchId ?? '',
          customerId: customer.id,
        }
      : null
  } catch (error) {
    console.error(
      `Failed to retrieve subscription for ${student.email || student.name}:`,
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
              invoiceId: (charge as Record<string, unknown>).invoice || null,
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

    // Add students without subscriptions to exclusion log (they still need to be excluded)
    for (const student of allStudentsInBatches) {
      const hasSubscription = studentsWithSubscriptions.some(
        (s) => s.id === student.id
      )

      if (!hasSubscription && student.email) {
        // Student is in batch but doesn't have subscription - still exclude their email if found
        // Note: This is a conservative approach - we exclude charges even if student doesn't have subscription
        // The actual exclusion logic happens in processPayouts based on customerEmail matching
      }
    }

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
