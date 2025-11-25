/**
 * Signature Verification Tests
 */

import { vi, describe, it, beforeEach } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

import { setupBeforeEach } from './before-each-setup'
import { createBaseEvent, runWebhookTest } from './test-setup'

describe('Dugsi Webhook Handler > Signature Verification', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should reject requests without signature', async () => {
    await runWebhookTest({
      event: null,
      signature: null,
      expectedStatus: 400,
      expectedBody: { message: 'Missing signature' },
    })
  })

  it('should reject requests with invalid signature', async () => {
    const mockEvent = createBaseEvent()

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        vi.mocked(verifyDugsiWebhook).mockImplementation(() => {
          throw new Error('Webhook verification failed: Invalid signature')
        })
      },
      expectedStatus: 401,
      expectedBody: { message: 'Invalid webhook signature' },
    })
  })
})
