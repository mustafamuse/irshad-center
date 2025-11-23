/**
 * Transaction mock helpers
 */

import { vi } from 'vitest'

import { prisma } from '@/lib/db'

import type {
  TransactionSpies,
  TransactionMockOptions,
  TestProgramProfile,
} from './types'

/**
 * Build a transaction mock with isolated spies for new schema
 * Returns spies that can be asserted directly without closures
 */
export function buildPrismaProfileTxMock(
  options: TransactionMockOptions = {}
): {
  tx: Partial<TransactionSpies>
  spies: Partial<TransactionSpies>
} {
  const profiles = options.profiles ?? [
    {
      id: '1',
      personId: 'person_1',
      program: 'DUGSI_PROGRAM',
      person: { id: 'person_1', name: 'Child 1' },
    },
  ]
  const updateCount = options.updateCount ?? profiles.length

  const programProfile = {
    findMany: vi.fn().mockResolvedValue(profiles),
    findFirst: vi.fn().mockResolvedValue(profiles[0]),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
  }

  const guardianRelationship = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  }

  const person = {
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
  }

  const contactPoint = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }

  const billingAccount = {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ id: 'billing_1' }),
  }

  const subscription = {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ id: 'sub_1' }),
    update: vi.fn().mockResolvedValue({ id: 'sub_1' }),
  }

  const billingAssignment = {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'assignment_1' }),
    update: vi.fn().mockResolvedValue({ id: 'assignment_1' }),
  }

  const enrollment = {
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'enrollment_1' }),
  }

  const tx = {
    programProfile,
    guardianRelationship,
    person,
    contactPoint,
    billingAccount,
    subscription,
    billingAssignment,
    enrollment,
  }

  return { tx, spies: tx }
}

/**
 * Install a transaction mock for a test
 * Returns a restore function to clean up after the test
 */
export function installTransaction(tx: Partial<TransactionSpies>): () => void {
  const mock = vi.mocked(prisma.$transaction)
  mock.mockImplementation(async (fn) =>
    fn(
      tx as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
    )
  )
  return () => mock.mockReset()
}

/**
 * Build a payment method transaction mock for new schema
 * Specifically for checkout.session.completed events
 */
export function buildPaymentMethodTxMock(profileCount: number = 2): {
  tx: Partial<TransactionSpies>
  spies: Partial<TransactionSpies>
} {
  const profiles: TestProgramProfile[] = Array.from(
    { length: profileCount },
    (_, i) => ({
      id: `profile_${i + 1}`,
      personId: `person_${i + 1}`,
      program: 'DUGSI_PROGRAM',
      familyReferenceId: 'dugsi_family_123',
      person: { id: `person_${i + 1}`, name: `Child ${i + 1}` },
    })
  )

  const guardianRelationship = {
    findFirst: vi.fn().mockResolvedValue({
      id: 'guardian_rel_1',
      guardianId: 'guardian_person_1',
      dependentId: 'person_1',
      guardian: {
        id: 'guardian_person_1',
        name: 'Parent Guardian',
        contactPoints: [
          {
            id: 'contact_1',
            type: 'EMAIL',
            value: 'parent@example.com',
          },
        ],
      },
    }),
    findMany: vi.fn().mockResolvedValue([]),
  }

  const person = {
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
  }

  const contactPoint = {
    findFirst: vi.fn().mockResolvedValue({
      id: 'contact_1',
      type: 'EMAIL',
      value: 'parent@example.com',
    }),
    findMany: vi.fn().mockResolvedValue([]),
  }

  const billingAccount = {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({
      id: 'billing_1',
      personId: 'guardian_person_1',
      accountType: 'DUGSI',
    }),
  }

  const programProfile = {
    findMany: vi.fn().mockResolvedValue(profiles),
    findFirst: vi.fn().mockResolvedValue(profiles[0]),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: profileCount }),
  }

  const tx = {
    programProfile,
    guardianRelationship,
    person,
    contactPoint,
    billingAccount,
  }

  return { tx, spies: tx }
}

/**
 * Build a failing transaction mock
 * For testing error scenarios
 */
export function buildFailingTxMock(error: Error): {
  install: () => void
  restore: () => void
} {
  const mock = vi.mocked(prisma.$transaction)
  return {
    install: () => {
      mock.mockRejectedValueOnce(error)
    },
    restore: () => mock.mockReset(),
  }
}
