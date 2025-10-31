/**
 * Test helper utilities for Dugsi webhook tests
 *
 * Provides isolated, spy-based transaction mocks without closure state
 * to ensure test isolation and prevent order dependencies.
 */

import { vi } from 'vitest'

import { prisma } from '@/lib/db'

/**
 * Student data type for test mocks
 */
export interface TestStudent {
  id: string
  name?: string
  subscriptionStatus?: string | null
}

/**
 * Transaction spies returned by buildPrismaStudentTxMock
 */
export interface TransactionSpies {
  student: {
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
}

/**
 * Transaction mock builder options
 */
export interface TransactionMockOptions {
  students?: TestStudent[]
  updateCount?: number
}

/**
 * Build a transaction mock with isolated spies
 * Returns spies that can be asserted directly without closures
 */
export function buildPrismaStudentTxMock(
  options: TransactionMockOptions = {}
): {
  tx: { student: TransactionSpies['student'] }
  spies: TransactionSpies
} {
  const students = options.students ?? [{ id: '1', name: 'Child 1' }]
  const updateCount = options.updateCount ?? students.length

  const findMany = vi.fn().mockResolvedValue(students)
  const update = vi.fn().mockResolvedValue({})
  const updateMany = vi.fn().mockResolvedValue({ count: updateCount })

  const student = { findMany, update, updateMany }
  const tx = { student }

  return { tx, spies: { student } }
}

/**
 * Install a transaction mock for a test
 * Returns a restore function to clean up after the test
 */
export function installTransaction(tx: {
  student: Partial<TransactionSpies['student']>
}): () => void {
  const mock = vi.mocked(prisma.$transaction)
  mock.mockImplementation(async (fn) => fn(tx as any))
  return () => mock.mockReset()
}

/**
 * Build a payment method transaction mock
 * Specifically for checkout.session.completed events
 */
export function buildPaymentMethodTxMock(updateCount: number = 2): {
  tx: { student: { updateMany: ReturnType<typeof vi.fn> } }
  spies: { student: { updateMany: ReturnType<typeof vi.fn> } }
} {
  const updateMany = vi.fn().mockResolvedValue({ count: updateCount })
  const student = { updateMany }
  const tx = { student }

  return { tx, spies: { student } }
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
