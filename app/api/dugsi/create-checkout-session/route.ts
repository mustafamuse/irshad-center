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

import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import { createDugsiCheckoutSession } from '@/lib/services/dugsi'
import { DugsiCheckoutRequestSchema } from '@/lib/validations/dugsi-checkout'

const logger = createServiceLogger('dugsi-checkout')

export async function POST(request: NextRequest) {
  let requestContext: Record<string, unknown> = {}

  try {
    // Parse and validate request body with Zod
    const rawBody = await request.json()
    const parseResult = DugsiCheckoutRequestSchema.safeParse(rawBody)

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    const { familyId, childCount, overrideAmount, successUrl, cancelUrl } =
      parseResult.data

    requestContext = { familyId, childCount, overrideAmount }

    // Log if client provides childCount (for debugging) - service will use DB count
    if (childCount !== undefined) {
      await logWarning(
        logger,
        'Client provided childCount - service will use DB count',
        { familyId, providedChildCount: childCount }
      )
    }

    // Call the checkout service
    const result = await createDugsiCheckoutSession({
      familyId,
      overrideAmount,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({
      sessionId: result.sessionId,
      url: result.url,
      calculatedRate: result.calculatedRate,
      finalRate: result.finalRate,
      isOverride: result.isOverride,
      rateDescription: result.rateDescription,
    })
  } catch (error) {
    // Handle ActionError with proper status codes
    if (error instanceof ActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

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
