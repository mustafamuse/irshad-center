/**
 * Error Handling Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { prisma } from '@/lib/db'

import { setupBeforeEach } from './before-each-setup'
import {
  createBaseEvent,
  createCheckoutEvent,
  getResponseBody,
  runWebhookTest,
  setupWebhookMocks,
  TEST_CONSTANTS,
} from './test-setup'

describe('Dugsi Webhook Handler > Error Handling', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should handle database transaction failures', async () => {
    const mockEvent = createCheckoutEvent(
      {},
      { id: TEST_CONSTANTS.EVENT_IDS.DB_ERROR }
    )

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)

        // Mock a database error during payment method capture
        const { getProgramProfilesByFamilyId } = await import(
          '@/lib/db/queries/program-profile'
        )

        vi.mocked(getProgramProfilesByFamilyId).mockRejectedValue(
          new Error('Database connection error')
        )
      },
      expectedStatus: 500,
      expectedBody: { message: 'Internal server error' },
      customAssertions: () => {
        expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({
          where: {
            eventId_source: {
              eventId: TEST_CONSTANTS.EVENT_IDS.DB_ERROR,
              source: 'dugsi',
            },
          },
        })
      },
    })
  })

  it('should return 200 for data issues to prevent retry', async () => {
    const mockEvent = createCheckoutEvent(
      {},
      { id: TEST_CONSTANTS.EVENT_IDS.NO_STUDENTS }
    )

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)

        // Mock no profiles found
        const { getProgramProfilesByFamilyId } = await import(
          '@/lib/db/queries/program-profile'
        )
        vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([])
      },
      expectedStatus: 200,
      customAssertions: (response) => {
        const body = getResponseBody(response)
        expect(body.received).toBe(true)
        // The handler should succeed but log a warning
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('No profiles found for family')
        )
      },
    })
  })

  it('should handle unhandled event types gracefully', async () => {
    const mockEvent = createBaseEvent({
      id: TEST_CONSTANTS.EVENT_IDS.UNHANDLED,
      type: 'invoice.payment_failed',
    })

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        setupWebhookMocks(mockEvent)
      },
      expectedStatus: 200,
      customAssertions: () => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(
            '⚠️ Unhandled Dugsi event type: invoice.payment_failed'
          )
        )
      },
    })
  })
})
