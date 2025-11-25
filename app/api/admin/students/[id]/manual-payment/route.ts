import { NextResponse } from 'next/server'

import { z } from 'zod'

import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/admin/students/[id]/manual-payment')

const manualPaymentSchema = z.object({
  year: z
    .number()
    .int()
    .min(2020)
    .max(new Date().getFullYear() + 1),
  month: z.number().int().min(1).max(12),
  amountPaid: z.number().int().positive(),
  paidAt: z.string().datetime().optional(),
  stripeInvoiceId: z.string().optional(),
})

// POST /api/admin/students/[id]/manual-payment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify profile exists
    const profile = await getProgramProfileById(id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = manualPaymentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 }
      )
    }

    const { year, month, amountPaid, paidAt, stripeInvoiceId } = validation.data

    // Check if payment already exists (if stripeInvoiceId provided)
    if (stripeInvoiceId) {
      const existing = await prisma.studentPayment.findUnique({
        where: {
          programProfileId_stripeInvoiceId: {
            programProfileId: id,
            stripeInvoiceId,
          },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Payment with this invoice ID already exists' },
          { status: 409 }
        )
      }
    }

    // Create payment record
    const payment = await prisma.studentPayment.create({
      data: {
        programProfileId: id,
        year,
        month,
        amountPaid,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        stripeInvoiceId: stripeInvoiceId || null,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error creating manual payment'
    )
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create manual payment',
      },
      { status: 500 }
    )
  }
}
