/**
 * Mahad Checkout Session API
 *
 * Creates a Stripe Checkout Session with dynamically calculated pricing
 * based on student billing configuration (graduation status, payment frequency).
 *
 * Billing type is always FULL_TIME at checkout - admin adjusts afterward if needed.
 */

import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { prisma } from '@/lib/db'
import { getMahadKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import { getAppUrl } from '@/lib/utils/env'
import {
  calculateMahadRate,
  formatBillingType,
  formatGraduationStatus,
  formatRateDisplay,
  getStripeInterval,
  shouldCreateSubscription,
} from '@/lib/utils/mahad-tuition'
import {
  CheckoutRequestSchema,
  MAX_EXPECTED_RATE_CENTS,
} from '@/lib/validations/checkout'

const logger = createServiceLogger('mahad-checkout')

export async function POST(request: NextRequest) {
  let requestContext: Record<string, unknown> = {}

  try {
    // Validate app URL configuration
    const appUrl = getAppUrl()

    // Parse and validate request body with Zod
    const rawBody = await request.json()
    const parseResult = CheckoutRequestSchema.safeParse(rawBody)

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    const {
      profileId,
      graduationStatus,
      paymentFrequency,
      billingType = 'FULL_TIME',
      successUrl = `${appUrl}/mahad/register?success=true`,
      cancelUrl = `${appUrl}/mahad/register?canceled=true`,
    } = parseResult.data

    requestContext = { profileId, graduationStatus, paymentFrequency }

    // Check if billing type is exempt (shouldn't happen since default is FULL_TIME)
    if (!shouldCreateSubscription(billingType)) {
      return NextResponse.json(
        { error: 'Exempt students do not need to set up payment' },
        { status: 400 }
      )
    }

    // Get the student profile with email and billing account in one query
    const profile = await prisma.programProfile.findUnique({
      where: { id: profileId },
      include: {
        person: {
          include: {
            contactPoints: {
              where: { type: 'EMAIL', isActive: true },
              orderBy: { isPrimary: 'desc' },
              take: 1,
            },
            billingAccounts: {
              select: { stripeCustomerIdMahad: true },
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

    // Validate email exists
    const email = profile.person.contactPoints[0]?.value
    if (!email) {
      return NextResponse.json(
        { error: 'Student email address is required for payment setup' },
        { status: 400 }
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

    // Rate bounds validation - warn on unusually high rates
    if (rateInCents > MAX_EXPECTED_RATE_CENTS) {
      await logWarning(logger, 'Unusually high rate calculated', {
        rateInCents,
        maxExpected: MAX_EXPECTED_RATE_CENTS,
        profileId,
        graduationStatus,
        paymentFrequency,
        billingType,
      })
    }

    // Get Stripe interval configuration
    const intervalConfig = getStripeInterval(paymentFrequency)

    // Get validated product ID from centralized keys
    const { productId } = getMahadKeys()
    if (!productId) {
      await logError(
        logger,
        new Error('STRIPE_MAHAD_PRODUCT_ID not configured'),
        'Stripe product not configured',
        { profileId }
      )
      return NextResponse.json(
        { error: 'Payment system not properly configured' },
        { status: 500 }
      )
    }

    // Update profile BEFORE creating Stripe session to prevent race condition where:
    // 1. User completes Stripe checkout
    // 2. Webhook fires before this function returns
    // 3. Webhook reads stale billing config from database
    // If Stripe fails, the profile still reflects the user's intended billing config
    await prisma.programProfile.update({
      where: { id: profileId },
      data: {
        graduationStatus,
        paymentFrequency,
        billingType,
      },
    })

    const stripe = getMahadStripeClient()

    // Use existing Stripe customer if available (from combined profile query)
    const customerId =
      profile.person.billingAccounts[0]?.stripeCustomerIdMahad ?? undefined

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['us_bank_account'],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
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

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    // Check for Zod validation errors
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => e.message).join(', ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    await logError(
      logger,
      error,
      'Failed to create checkout session',
      requestContext
    )
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
