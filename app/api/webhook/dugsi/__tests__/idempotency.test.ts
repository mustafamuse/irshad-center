/**
 * Idempotency Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { prisma } from '@/lib/db'

import { setupBeforeEach } from './before-each-setup'
import {
  buildPaymentMethodTxMock,
  installTransaction,
  setupCheckoutScenario,
} from './helpers'
import {
  createBaseEvent,
  createCheckoutEvent,
  runWebhookTest,
  setupWebhookMocks,
  TEST_CONSTANTS,
} from './test-setup'

describe('Dugsi Webhook Handler > Idempotency', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should skip already processed events', async () => {
    const mockEvent = createBaseEvent({
      id: TEST_CONSTANTS.EVENT_IDS.DUPLICATE,
    })

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        setupWebhookMocks(mockEvent, { isProcessed: true })
      },
      expectedStatus: 200,
      expectedBody: { received: true, skipped: true },
      customAssertions: () => {
        expect(prisma.webhookEvent.create).not.toHaveBeenCalled()
      },
    })
  })

  it('should record new events to prevent duplicates', async () => {
    const mockEvent = createCheckoutEvent(
      {},
      {
        id: TEST_CONSTANTS.EVENT_IDS.NEW,
      }
    )

    const { tx } = buildPaymentMethodTxMock(2)
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)
        await setupCheckoutScenario({ profileCount: 2 })
      },
      expectedStatus: 200,
      customAssertions: (response) => {
        if (response.status !== 200) {
          console.log('Response body:', JSON.stringify(response.body, null, 2))
        }
        expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
          data: {
            eventId: TEST_CONSTANTS.EVENT_IDS.NEW,
            eventType: 'checkout.session.completed',
            source: 'dugsi',
            payload: mockEvent,
          },
        })
      },
    })

    restore?.()
  })
})
