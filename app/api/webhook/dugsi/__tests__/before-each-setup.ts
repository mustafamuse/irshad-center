/**
 * Shared beforeEach setup for Dugsi webhook tests
 */

import type Stripe from 'stripe'
import { vi } from 'vitest'

import { prisma } from '@/lib/db'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

import { setupAllQueryMocks, createMockGuardianRelationship } from './helpers'
import { setupHeadersMock, setupDefaultWebhookMocks } from './test-setup'

/**
 * Setup function to be called in beforeEach
 */
export async function setupBeforeEach() {
  console.log = vi.fn()
  console.error = vi.fn()
  console.warn = vi.fn()

  // Clear all mock call history (keeps implementations)
  vi.clearAllMocks()

  await setupHeadersMock()
  setupDefaultWebhookMocks()

  // Setup all default query function mocks
  await setupAllQueryMocks()

  // Set up default prisma mocks for guardian relationships
  // Use vi.mocked() directly like Mahad tests - it works because mocks are properly set up
  vi.mocked(prisma.guardianRelationship.findFirst).mockResolvedValue(
    createMockGuardianRelationship() as unknown as Awaited<
      ReturnType<typeof prisma.guardianRelationship.findFirst>
    >
  )

  // Reset transaction mock to use the SAME prisma mock objects
  // This ensures tests can mock prisma models and they will work inside transactions
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
    const tx = {
      programProfile: prisma.programProfile,
      person: prisma.person,
      contactPoint: prisma.contactPoint,
      billingAccount: prisma.billingAccount,
      subscription: prisma.subscription,
      billingAssignment: prisma.billingAssignment,
      guardianRelationship: prisma.guardianRelationship,
      enrollment: prisma.enrollment,
    }
    return callback(
      tx as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
    )
  })

  // Set default verification mock (tests can override via setupWebhookMocks)
  // This mock will be used if setupWebhookMocks is not called
  vi.mocked(verifyDugsiWebhook).mockImplementation((body, _signature) => {
    // Try to parse the body - if it fails, return a minimal event
    try {
      const parsed = JSON.parse(body)
      // Ensure it has required fields
      if (parsed && parsed.id && parsed.type) {
        return parsed as Stripe.Event
      }
    } catch {
      // If parsing fails, return a minimal valid event
    }
    // Return a minimal valid event structure
    return {
      id: 'evt_default',
      object: 'event',
      type: 'checkout.session.completed',
      created: Date.now(),
      data: { object: {} },
    } as Stripe.Event
  })
}
