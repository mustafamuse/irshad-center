import { vi, describe, it, expect, beforeEach } from 'vitest'

import './mocks'

import { setupBeforeEach } from './before-each-setup'
import {
  buildPrismaProfileTxMock,
  buildFailingTxMock,
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
  TEST_CONSTANTS,
} from './test-setup'

describe('Dugsi Webhook Handler > Subscription Events', () => {
  beforeEach(async () => {
    await setupBeforeEach()
  })

  it('should handle subscription creation', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.created',
      { status: 'active' },
      { id: TEST_CONSTANTS.EVENT_IDS.SUB_CREATED }
    )

    const { tx } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(2),
    })
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)
        await setupSubscriptionCreatedScenario({ profileCount: 2 })

        const { createBillingAssignment } = await import(
          '@/lib/db/queries/billing'
        )
        vi.mocked(createBillingAssignment).mockResolvedValue({
          id: 'assignment_1',
        } as Awaited<ReturnType<typeof createBillingAssignment>>)
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { createSubscription } = await import('@/lib/db/queries/billing')
        // eslint-disable-next-line no-console
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('✅ Created new subscription')
        )
        expect(vi.mocked(createSubscription)).toHaveBeenCalled()
      },
    })

    restore?.()
  })

  it('should handle subscription updates', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.updated',
      { status: 'past_due' },
      { id: TEST_CONSTANTS.EVENT_IDS.SUB_UPDATED }
    )

    const { tx } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(2),
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
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { updateSubscriptionStatus } = await import(
          '@/lib/db/queries/billing'
        )
        expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalled()
      },
    })

    restore?.()
  })

  it('should handle subscription cancellation', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.deleted',
      { status: 'canceled' },
      { id: TEST_CONSTANTS.EVENT_IDS.SUB_CANCELED }
    )

    const { tx, spies } = buildPrismaProfileTxMock({
      profiles: createMockProgramProfiles(2),
    })
    let restore: (() => void) | undefined

    await runWebhookTest({
      event: mockEvent,
      setupMocks: async () => {
        setupWebhookMocks(mockEvent)
        restore = installTransaction(tx)
        await setupSubscriptionDeletedScenario({ assignmentCount: 2 })

        spies.enrollment?.findFirst?.mockResolvedValue({
          id: 'enrollment_1',
          status: 'ENROLLED',
        } as unknown)
      },
      expectedStatus: 200,
      customAssertions: async () => {
        const { updateBillingAssignmentStatus, updateSubscriptionStatus } =
          await import('@/lib/db/queries/billing')
        const { updateEnrollmentStatus } = await import(
          '@/lib/db/queries/enrollment'
        )

        expect(vi.mocked(updateBillingAssignmentStatus)).toHaveBeenCalledTimes(
          2
        )
        expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
          'sub_1',
          'canceled'
        )
        expect(vi.mocked(updateEnrollmentStatus)).toHaveBeenCalled()
      },
    })

    restore?.()
  })

  it('should validate subscription status against enum', async () => {
    const mockEvent = createSubscriptionEvent(
      'customer.subscription.created',
      { status: 'invalid_status' as unknown },
      { id: TEST_CONSTANTS.EVENT_IDS.INVALID_STATUS }
    )

    const { install, restore } = buildFailingTxMock(
      new Error('Invalid subscription status: invalid_status')
    )

    await runWebhookTest({
      event: mockEvent,
      setupMocks: () => {
        setupWebhookMocks(mockEvent)
        install()
      },
      expectedStatus: 500,
      customAssertions: () => {
        // eslint-disable-next-line no-console
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Dugsi Webhook Error')
        )
      },
    })

    restore()
  })
})
