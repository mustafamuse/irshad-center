/**
 * Edge Cases Tests
 */
import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { setupBeforeEach } from './before-each-setup'
import {
  buildPrismaProfileTxMock,
  installTransaction,
  createMockProgramProfiles,
  setupSubscriptionCreatedScenario,
} from './helpers'
import {
  createSubscriptionEvent,
  runWebhookTest,
  setupWebhookMocks,
  TEST_CONSTANTS,
} from './test-setup'

describe('Dugsi Webhook Handler > Edge Cases', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should handle customer object instead of string ID', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.created',
      {
        customer: {
          id: TEST_CONSTANTS.CUSTOMER.ID,
          object: 'customer',
        } as Stripe.Customer,
      },
      { id: TEST_CONSTANTS.EVENT_IDS.CUSTOMER_OBJECT }
    )

    const { tx } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(1),
    })
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)
        await setupSubscriptionCreatedScenario({ profileCount: 1 })
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { createSubscription } = await import('@/lib/db/queries/billing')
        expect(vi.mocked(createSubscription)).toHaveBeenCalled()
      },
    })

    restore?.()
  })

  it('should handle trialing subscription status gracefully', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.created',
      { status: 'trialing' },
      { id: TEST_CONSTANTS.EVENT_IDS.NO_PERIOD_END }
    )

    const { tx } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(1),
    })
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)

        const { createSubscription } = await import('@/lib/db/queries/billing')

        vi.mocked(createSubscription).mockResolvedValue({
          id: 'sub_1',
          status: 'trialing',
        } as Stripe.Subscription)

        await setupSubscriptionCreatedScenario({
          profileCount: 1,
          subscription: { id: 'sub_1', status: 'trialing' } as unknown,
        })
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { createSubscription } = await import('@/lib/db/queries/billing')
        expect(vi.mocked(createSubscription)).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'trialing',
          })
        )
      },
    })

    restore?.()
  })
})
