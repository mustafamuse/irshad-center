/**
 * Dugsi Checkout Session API
 *
 * Creates a Stripe Checkout Session for family-based billing.
 * Rate is calculated based on number of children with tiered discounts,
 * or can be overridden by admin.
 *
 * Key differences from Mahad:
 * - Family-based subscription (one per family, not per student)
 * - Rate based on child count with tiered discounts
 * - Admin-generated only (not self-service)
 * - ACH only (no card payments)
 */

import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { prisma } from '@/lib/db'
import { getDugsiKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  calculateDugsiRate,
  formatRate,
  formatRateDisplay,
  getStripeInterval,
  getRateTierDescription,
  MAX_EXPECTED_FAMILY_RATE,
} from '@/lib/utils/dugsi-tuition'
import { getAppUrl } from '@/lib/utils/env'
import { DugsiCheckoutRequestSchema } from '@/lib/validations/dugsi-checkout'

const logger = createServiceLogger('dugsi-checkout')

export async function POST(request: NextRequest) {
  let requestContext: Record<string, unknown> = {}

  try {
    // Validate app URL configuration
    const appUrl = getAppUrl()

    // Parse and validate request body with Zod
    const rawBody = await request.json()
    const parseResult = DugsiCheckoutRequestSchema.safeParse(rawBody)

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    const {
      familyId,
      childCount,
      overrideAmount,
      successUrl = `${appUrl}/dugsi?payment=success`,
      cancelUrl = `${appUrl}/dugsi?payment=canceled`,
    } = parseResult.data

    requestContext = { familyId, childCount, overrideAmount }

    // Get family profiles with guardian information
    const familyProfiles = await prisma.programProfile.findMany({
      where: {
        familyReferenceId: familyId,
        program: 'DUGSI_PROGRAM',
        status: { in: ['REGISTERED', 'ENROLLED'] },
      },
      include: {
        person: {
          include: {
            guardianRelationships: {
              include: {
                guardian: {
                  include: {
                    contactPoints: {
                      where: { type: 'EMAIL', isActive: true },
                      orderBy: { isPrimary: 'desc' },
                      take: 1,
                    },
                    billingAccounts: {
                      select: { stripeCustomerIdDugsi: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (familyProfiles.length === 0) {
      return NextResponse.json(
        { error: 'Family not found or no active students' },
        { status: 404 }
      )
    }

    // Validate child count matches actual family size (warn if mismatch)
    if (familyProfiles.length !== childCount) {
      await logWarning(logger, 'Child count mismatch with family profiles', {
        familyId,
        requestedChildCount: childCount,
        actualProfileCount: familyProfiles.length,
      })
    }

    // Get primary guardian (first guardian from first child's relationships)
    const firstChild = familyProfiles[0]
    const guardianRelationships = firstChild.person.guardianRelationships || []
    const primaryGuardian = guardianRelationships[0]?.guardian

    if (!primaryGuardian) {
      return NextResponse.json(
        { error: 'No guardian found for this family' },
        { status: 400 }
      )
    }

    // Validate guardian email exists
    const guardianEmail = primaryGuardian.contactPoints[0]?.value
    if (!guardianEmail) {
      return NextResponse.json(
        {
          error:
            'Guardian must have an email address on file to receive payment link',
        },
        { status: 400 }
      )
    }

    // Calculate rate using the tuition calculator or use override
    const calculatedRate = calculateDugsiRate(childCount)
    const rateInCents = overrideAmount ?? calculatedRate
    const isOverride = overrideAmount !== undefined

    if (rateInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid rate calculation' },
        { status: 400 }
      )
    }

    // Rate bounds validation - warn on unusually high rates
    if (rateInCents > MAX_EXPECTED_FAMILY_RATE) {
      await logWarning(logger, 'Unusually high rate for Dugsi checkout', {
        rateInCents,
        maxExpected: MAX_EXPECTED_FAMILY_RATE,
        familyId,
        childCount,
        isOverride,
      })
    }

    // Get Stripe interval configuration (monthly only for Dugsi)
    const intervalConfig = getStripeInterval()

    // Get validated product ID from centralized keys
    const { productId } = getDugsiKeys()
    if (!productId) {
      await logError(
        logger,
        new Error('STRIPE_DUGSI_PRODUCT_ID not configured'),
        'Stripe product not configured for Dugsi',
        { familyId }
      )
      return NextResponse.json(
        { error: 'Payment system not properly configured' },
        { status: 500 }
      )
    }

    const stripe = getDugsiStripeClient()

    // Use existing Stripe customer if available
    const customerId =
      primaryGuardian.billingAccounts[0]?.stripeCustomerIdDugsi ?? undefined

    // Build child names for metadata
    const childNames = familyProfiles.map((p) => p.person.name).join(', ')

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['us_bank_account'], // ACH only
      customer: customerId,
      customer_email: customerId ? undefined : guardianEmail,
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
          Family: primaryGuardian.name,
          Children: childNames,
          Rate: formatRateDisplay(rateInCents),
          Tier: getRateTierDescription(childCount),
          Source: 'Dugsi Admin Payment Link',
          // Technical (for webhook processing - DO NOT REMOVE)
          familyId,
          guardianPersonId: primaryGuardian.id,
          childCount: childCount.toString(),
          profileIds: familyProfiles.map((p) => p.id).join(','),
          calculatedRate: calculatedRate.toString(),
          overrideUsed: isOverride ? 'true' : 'false',
          source: 'dugsi-admin-payment-link',
        },
      },
      metadata: {
        // Human-readable (for Stripe dashboard)
        Family: primaryGuardian.name,
        Source: 'Dugsi Admin Payment Link',
        // Technical (for webhook processing)
        familyId,
        guardianPersonId: primaryGuardian.id,
        childCount: childCount.toString(),
        source: 'dugsi-admin-payment-link',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    })

    // Validate session URL was created
    if (!session.url) {
      await logError(
        logger,
        new Error('Stripe returned session without URL'),
        'Checkout session created without URL',
        { familyId, sessionId: session.id }
      )
      return NextResponse.json(
        { error: 'Failed to create payment link' },
        { status: 500 }
      )
    }

    logger.info(
      {
        familyId,
        guardianName: primaryGuardian.name,
        childCount,
        calculatedRate,
        finalRate: rateInCents,
        isOverride,
        sessionId: session.id,
      },
      'Dugsi checkout session created'
    )

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      calculatedRate,
      finalRate: rateInCents,
      isOverride,
      rateDescription: formatRate(rateInCents),
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
      'Failed to create Dugsi checkout session',
      requestContext
    )
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
