/**
 * Payment Method Capture Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { setupBeforeEach } from './before-each-setup'
import {
  buildPaymentMethodTxMock,
  installTransaction,
  setupCheckoutScenario,
} from './helpers'
import {
  createCheckoutEvent,
  getResponseBody,
  runWebhookTest,
  setupWebhookMocks,
  TEST_CONSTANTS,
} from './test-setup'

describe('Dugsi Webhook Handler > Payment Method Capture (checkout.session.completed)', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should update family billing account with payment method', async () => {
    const mockEvent = createCheckoutEvent(
      { customer_email: TEST_CONSTANTS.CUSTOMER.PARENT_EMAIL },
      { id: TEST_CONSTANTS.EVENT_IDS.PAYMENT }
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
      expectedBody: { received: true },
      customAssertions: async () => {
        const { upsertBillingAccount } = await import(
          '@/lib/db/queries/billing'
        )
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('✅ Payment method captured successfully')
        )
        expect(vi.mocked(upsertBillingAccount)).toHaveBeenCalled()
      },
    })

    restore?.()
  })

  it('should handle missing client_reference_id', async () => {
    const mockEvent = createCheckoutEvent(
      { client_reference_id: null },
      { id: TEST_CONSTANTS.EVENT_IDS.NO_REF }
    )

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        setupWebhookMocks(mockEvent)
      },
      expectedStatus: 200,
      customAssertions: (response) => {
        const body = getResponseBody(response)
        expect(body.warning).toContain('No client_reference_id')
      },
    })
  })

  it('should handle invalid customer ID', async () => {
    const mockEvent = createCheckoutEvent(
      { customer: undefined },
      { id: TEST_CONSTANTS.EVENT_IDS.NO_CUSTOMER }
    )

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        setupWebhookMocks(mockEvent)
      },
      expectedStatus: 200,
      customAssertions: (response) => {
        const body = getResponseBody(response)
        expect(body.warning).toContain('Invalid or missing customer ID')
      },
    })
  })
})
