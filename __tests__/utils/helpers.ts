/**
 * Test Helper Utilities
 *
 * Common testing utilities and helper functions used across test suites.
 */

import { vi } from 'vitest'

/**
 * Mock logger to suppress console output during tests
 */
export const mockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger()),
})

/**
 * Create a resolved promise (for mocking async functions)
 */
export const resolved = <T>(value: T) => Promise.resolve(value)

/**
 * Create a rejected promise (for mocking errors)
 */
export const rejected = (error: Error | string) =>
  Promise.reject(error instanceof Error ? error : new Error(error))

/**
 * Wait for all pending promises to resolve
 */
export const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Assert that a function throws a specific error
 */
export const expectToThrow = async (
  fn: () => Promise<unknown> | unknown,
  errorMessage?: string | RegExp
) => {
  try {
    await fn()
    throw new Error('Expected function to throw but it did not')
  } catch (error) {
    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect((error as Error).message).toContain(errorMessage)
      } else {
        expect((error as Error).message).toMatch(errorMessage)
      }
    }
    return error
  }
}

/**
 * Create a mock Date that can be controlled in tests
 */
export const mockDate = (isoDate: string) => {
  const mockDate = new Date(isoDate)
  vi.setSystemTime(mockDate)
  return mockDate
}

/**
 * Restore real Date after mocking
 */
export const restoreDate = () => {
  vi.useRealTimers()
}

/**
 * Mock crypto.randomUUID for predictable IDs in tests
 */
export const mockUUID = (uuid: string = 'test-uuid-123') => {
  const original = crypto.randomUUID
  crypto.randomUUID = vi.fn(() => uuid)
  return () => {
    crypto.randomUUID = original
  }
}

/**
 * Assert Prisma mock was called with specific data
 */
export const expectPrismaCall = (
  mockFn: any,
  expectedData: Record<string, unknown>
) => {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining(expectedData)
  )
}

/**
 * Reset all mocks (useful in beforeEach)
 */
export const resetAllMocks = () => {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
