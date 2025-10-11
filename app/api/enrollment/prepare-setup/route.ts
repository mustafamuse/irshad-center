import { NextResponse } from 'next/server'

import { z } from 'zod'

import { validateStudentForEnrollment } from '@/lib/queries/subscriptions'
import { stripeServerClient } from '@/lib/stripe'

const prepareSetupSchema = z.object({
  payerDetails: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().min(1, 'Phone number is required'),
    relationship: z.string().min(1, 'Relationship is required'),
  }),
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one student must be selected'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = prepareSetupSchema.parse(body)

    // Validate each student
    const validationPromises = data.studentIds.map((studentId) =>
      validateStudentForEnrollment(studentId)
    )
    const validationResults = await Promise.allSettled(validationPromises)

    // Check for validation failures
    const failures = validationResults.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )

    if (failures.length > 0) {
      return NextResponse.json(
        { error: `Student validation failed: ${failures[0].reason.message}` },
        { status: 400 }
      )
    }

    // Get validated students
    const validatedStudents = validationResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value.student)

    // Check if any students already have active subscriptions
    const studentsWithSubscriptions = validatedStudents.filter(
      (student) =>
        student.stripeSubscriptionId && student.subscriptionStatus === 'active'
    )

    if (studentsWithSubscriptions.length > 0) {
      return NextResponse.json(
        {
          error: `Some students already have active subscriptions: ${studentsWithSubscriptions
            .map((s) => s.name)
            .join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Calculate total monthly rate
    const totalMonthlyRate = validatedStudents.reduce(
      (sum, student) => sum + student.monthlyRate,
      0
    )

    // Check for existing Stripe customer with this email
    let customer
    try {
      const customers = await stripeServerClient.customers.list({
        email: data.payerDetails.email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customer = customers.data[0]
      }
    } catch (error) {
      console.log('Error checking for existing customer:', error)
    }

    // Create customer if none exists
    if (!customer) {
      customer = await stripeServerClient.customers.create({
        email: data.payerDetails.email,
        name: `${data.payerDetails.firstName} ${data.payerDetails.lastName}`,
        phone: data.payerDetails.phone,
        metadata: {
          enrollmentPending: 'true',
          relationship: data.payerDetails.relationship,
          source: 'enrollment_flow',
        },
      })
    }

    // Create SetupIntent for ACH bank account
    const setupIntent = await stripeServerClient.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['us_bank_account'],
      usage: 'off_session',
      metadata: {
        payerDetails: JSON.stringify(data.payerDetails),
        studentIds: JSON.stringify(data.studentIds),
        totalMonthlyRate: totalMonthlyRate.toString(),
        enrollmentFlow: 'true',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        setupIntentClientSecret: setupIntent.client_secret,
        customerId: customer.id,
        customerEmail: customer.email,
        totalMonthlyRate,
        Student: validatedStudents.map((student) => ({
          id: student.id,
          name: student.name,
          monthlyRate: student.monthlyRate,
          batchName: student.batch?.name,
        })),
      },
    })
  } catch (error) {
    console.error('Error preparing setup:', error)

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
      { error: 'Failed to prepare enrollment setup' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
