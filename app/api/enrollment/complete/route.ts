import { NextResponse } from 'next/server'

import { z } from 'zod'

import { prisma } from '@/lib/db'
// import { handleStripeError } from '@/lib/errors'
import { validateStudentForEnrollment } from '@/lib/queries/subscriptions'
import { stripeServerClient } from '@/lib/stripe'

const completeEnrollmentSchema = z.object({
  setupIntentId: z.string(),
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one student required'),
})

export async function POST(req: Request) {
  try {
    // 1. Parse and validate request body
    const body = await req.json()
    const { setupIntentId, studentIds } = completeEnrollmentSchema.parse(body)

    // 2. Verify SetupIntent and get stored metadata
    const setupIntent = await stripeServerClient.setupIntents.retrieve(
      setupIntentId,
      {
        expand: ['payment_method'],
      }
    )

    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Bank account setup not completed' },
        { status: 400 }
      )
    }

    // 3. Parse metadata
    const payerDetails = JSON.parse(setupIntent.metadata?.payerDetails || '{}')
    const storedStudentIds = JSON.parse(
      setupIntent.metadata?.studentIds || '[]'
    )

    // 4. Verify student IDs match
    if (
      JSON.stringify(studentIds.sort()) !==
      JSON.stringify(storedStudentIds.sort())
    ) {
      return NextResponse.json(
        { error: 'Student selection mismatch' },
        { status: 400 }
      )
    }

    // 5. Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 6. Validate each student
      const validationPromises = studentIds.map((studentId) =>
        validateStudentForEnrollment(studentId)
      )
      const validationResults = await Promise.allSettled(validationPromises)

      // Check for validation failures
      const failures = validationResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )

      if (failures.length > 0) {
        throw new Error(
          `Student validation failed: ${failures[0].reason.message}`
        )
      }

      // Get validated student details
      const validatedStudents = validationResults.map(
        (result) => (result as PromiseFulfilledResult<any>).value.student
      )

      // 7. Update students with Stripe customer ID
      await tx.student.updateMany({
        where: { id: { in: studentIds } },
        data: {
          stripeCustomerId: setupIntent.customer as string,
          updatedAt: new Date(),
        },
      })

      // 8. Set payment method as default for customer
      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id

      if (!paymentMethodId) {
        throw new Error('Invalid or missing payment method')
      }

      await stripeServerClient.customers.update(
        setupIntent.customer as string,
        {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        }
      )

      // 9. Create subscription in Stripe (but let webhook handle the database record)
      const subscription = await stripeServerClient.subscriptions.create({
        customer: setupIntent.customer as string,
        items: validatedStudents.map((student) => ({
          price_data: {
            currency: 'usd',
            product: process.env.STRIPE_PRODUCT_ID!,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
            unit_amount: student.monthlyRate * 100, // Convert to cents
          },
          metadata: {
            studentId: student.id,
            studentName: student.name,
            isCustomRate: student.customRate ? 'true' : 'false',
            monthlyRate: student.monthlyRate.toString(),
          },
        })),
        payment_settings: {
          payment_method_types: ['us_bank_account'],
          save_default_payment_method: 'on_subscription',
        },
        metadata: {
          studentIds: JSON.stringify(studentIds),
          totalMonthlyRate: validatedStudents
            .reduce((sum, s) => sum + s.monthlyRate, 0)
            .toString(),
          enrollmentDate: new Date().toISOString(),
          totalStudents: validatedStudents.length.toString(),
          payerName: `${payerDetails.firstName} ${payerDetails.lastName}`,
          payerEmail: payerDetails.email,
          payerPhone: payerDetails.phone,
          relationship: payerDetails.relationship,
        },
      })

      // 10. Update students with subscription ID
      await tx.student.updateMany({
        where: { id: { in: studentIds } },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status as any,
          updatedAt: new Date(),
        },
      })

      // 11. Mark customer enrollment as complete
      await stripeServerClient.customers.update(
        setupIntent.customer as string,
        {
          metadata: {
            enrollmentPending: 'false',
            enrollmentCompleted: 'true',
            completedAt: new Date().toISOString(),
            studentIds: JSON.stringify(studentIds),
          },
        }
      )

      return {
        subscriptionId: subscription.id,
        customerId: setupIntent.customer,
        Student: validatedStudents,
        payerDetails,
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error completing enrollment:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    // Handle Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      return NextResponse.json(
        { error: 'Payment processing error' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to complete enrollment' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
