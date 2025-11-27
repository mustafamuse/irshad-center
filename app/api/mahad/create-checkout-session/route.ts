/**
 * Mahad Checkout Session API
 *
 * Creates a Stripe Checkout Session with dynamically calculated pricing
 * based on student billing configuration (graduation status, payment frequency).
 *
 * Billing type is always FULL_TIME at checkout - admin adjusts afterward if needed.
 */

import { NextRequest, NextResponse } from 'next/server'

import {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { createServiceLogger } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import {
  calculateMahadRate,
  formatBillingType,
  formatGraduationStatus,
  formatRateDisplay,
  getStripeInterval,
  shouldCreateSubscription,
} from '@/lib/utils/mahad-tuition'

const logger = createServiceLogger('mahad-checkout')

interface CheckoutRequest {
  profileId: string
  graduationStatus: GraduationStatus
  paymentFrequency: PaymentFrequency
  billingType?: StudentBillingType // Optional - defaults to FULL_TIME (admin adjusts afterward)
  successUrl?: string
  cancelUrl?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequest

    const {
      profileId,
      graduationStatus,
      paymentFrequency,
      billingType = 'FULL_TIME', // Default to FULL_TIME - admin adjusts afterward if needed
      successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/mahad/register?success=true`,
      cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/mahad/register?canceled=true`,
    } = body

    // Validate required fields (billingType has a default, so not required from client)
    if (!profileId || !graduationStatus || !paymentFrequency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if billing type is exempt (shouldn't happen since default is FULL_TIME)
    if (!shouldCreateSubscription(billingType)) {
      return NextResponse.json(
        { error: 'Exempt students do not need to set up payment' },
        { status: 400 }
      )
    }

    // Get the student profile
    const profile = await prisma.programProfile.findUnique({
      where: { id: profileId },
      include: {
        person: {
          include: {
            contactPoints: {
              where: { type: 'EMAIL', isPrimary: true },
              take: 1,
            },
          },
        },
      },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      )
    }

    // Calculate rate using the tuition calculator
    const rateInCents = calculateMahadRate(
      graduationStatus,
      paymentFrequency,
      billingType
    )

    if (rateInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid rate calculation' },
        { status: 400 }
      )
    }

    // Get Stripe interval configuration
    const intervalConfig = getStripeInterval(paymentFrequency)

    // Get student email
    const email = profile.person.contactPoints[0]?.value

    const stripe = getMahadStripeClient()

    // Create or retrieve Stripe customer
    let customerId: string | undefined

    // Check if this person already has a billing account with a Stripe customer
    const existingBillingAccount = await prisma.billingAccount.findFirst({
      where: { personId: profile.personId },
      select: { stripeCustomerIdMahad: true },
    })

    if (existingBillingAccount?.stripeCustomerIdMahad) {
      customerId = existingBillingAccount.stripeCustomerIdMahad
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'us_bank_account'],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: process.env.STRIPE_MAHAD_PRODUCT_ID,
            unit_amount: rateInCents,
            recurring: intervalConfig,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          // Human-readable (for Stripe dashboard)
          Student: profile.person.name,
          Rate: formatRateDisplay(rateInCents, paymentFrequency),
          Status: formatGraduationStatus(graduationStatus),
          Type: formatBillingType(billingType),
          Source: 'Mahad Registration',
          // Technical (for webhook processing - DO NOT REMOVE)
          profileId: profile.id,
          personId: profile.personId,
          studentName: profile.person.name,
          graduationStatus,
          paymentFrequency,
          billingType,
          calculatedRate: rateInCents.toString(),
          source: 'mahad-registration',
        },
      },
      metadata: {
        // Human-readable (for Stripe dashboard)
        Student: profile.person.name,
        Source: 'Mahad Registration',
        // Technical (for webhook processing)
        profileId: profile.id,
        personId: profile.personId,
        studentName: profile.person.name,
        source: 'mahad-registration',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Allow promotion codes if configured
      allow_promotion_codes: true,
    })

    logger.info(
      {
        profileId: profile.id,
        studentName: profile.person.name,
        graduationStatus,
        paymentFrequency,
        billingType,
        calculatedRate: rateInCents,
        sessionId: session.id,
      },
      'Checkout session created'
    )

    // Update the profile with billing configuration
    await prisma.programProfile.update({
      where: { id: profileId },
      data: {
        graduationStatus,
        paymentFrequency,
        billingType,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to create checkout session')
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
