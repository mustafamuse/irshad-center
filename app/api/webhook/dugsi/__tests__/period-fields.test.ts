/**
 * Period Fields Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Import mocks FIRST to ensure they're hoisted by Vitest
import './mocks'

import { setupBeforeEach } from './before-each-setup'
import {
  buildPrismaProfileTxMock,
  installTransaction,
  createMockProgramProfiles,
  setupSubscriptionCreatedScenario,
  setupSubscriptionUpdatedScenario,
  setupSubscriptionDeletedScenario,
} from './helpers'
import {
  createSubscriptionEvent,
  runWebhookTest,
  setupWebhookMocks,
} from './test-setup'

describe('Dugsi Webhook Handler > handleSubscriptionEvent - Period Fields', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should sync currentPeriodStart and currentPeriodEnd on Subscription', async () => {
    const periodStartTimestamp = Math.floor(Date.now() / 1000)
    const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.created',
      {
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      },
      { id: 'evt_period_fields_test' }
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

        const mockSubscription = {
          id: 'sub_1',
          currentPeriodStart: new Date(periodStartTimestamp * 1000),
          currentPeriodEnd: new Date(periodEndTimestamp * 1000),
          paidUntil: new Date(periodEndTimestamp * 1000),
        }

        vi.mocked(createSubscription).mockResolvedValue(
          mockSubscription as Awaited<ReturnType<typeof createSubscription>>
        )

        await setupSubscriptionCreatedScenario({
          profileCount: 1,
          subscription: mockSubscription,
        })
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { createSubscription } = await import('@/lib/db/queries/billing')
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('✅ Created new subscription')
        )
        expect(vi.mocked(createSubscription)).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPeriodStart: expect.any(Date),
            currentPeriodEnd: expect.any(Date),
            paidUntil: expect.any(Date),
          })
        )
      },
    })

    restore?.()
  })

  it('should update subscription period when status changes', async () => {
    const periodStartTimestamp = Math.floor(Date.now() / 1000)
    const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.updated',
      {
        status: 'past_due',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      },
      { id: 'evt_status_updated_test' }
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

        await setupSubscriptionUpdatedScenario({
          currentStatus: 'active',
          newStatus: 'past_due',
        })

        const { updateSubscriptionStatus } = await import(
          '@/lib/db/queries/billing'
        )
        vi.mocked(updateSubscriptionStatus).mockResolvedValue({
          id: 'sub_1',
          status: 'past_due',
          currentPeriodStart: new Date(periodStartTimestamp * 1000),
          currentPeriodEnd: new Date(periodEndTimestamp * 1000),
        } as Awaited<ReturnType<typeof updateSubscriptionStatus>>)

        await setupSubscriptionUpdatedScenario({
          currentStatus: 'active',
          newStatus: 'past_due',
        })
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { updateSubscriptionStatus } = await import(
          '@/lib/db/queries/billing'
        )
        expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
          'sub_1',
          'past_due',
          expect.objectContaining({
            currentPeriodStart: expect.any(Date),
            currentPeriodEnd: expect.any(Date),
            paidUntil: expect.any(Date),
          })
        )
      },
    })

    restore?.()
  })

  it('should update subscription status to canceled', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.deleted',
      { status: 'canceled' },
      { id: 'evt_period_cancel_test' }
    )

    const { tx, spies } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(1),
    })
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)
        await setupSubscriptionDeletedScenario({ assignmentCount: 1 })

        spies.enrollment?.findFirst?.mockResolvedValue({
          id: 'enrollment_1',
          status: 'ENROLLED',
        } as unknown)
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { updateSubscriptionStatus } = await import(
          '@/lib/db/queries/billing'
        )
        expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
          'sub_1',
          'canceled'
        )
      },
    })

    restore?.()
  })
})
