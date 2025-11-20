'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/db'
import { stripeServerClient } from '@/lib/stripe'

export async function getBatchesForFilter() {
  try {
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        name: true,
      },
      where: {
        name: {
          not: 'Test',
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    return batches
  } catch (error) {
    console.error('Failed to fetch batches:', error)
    return []
  }
}

export async function runPaymentsBackfill() {
  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  return {
    success: false,
    message: 'Migration needed - Student model removed',
  }
}
