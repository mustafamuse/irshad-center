/**
 * Prisma Mock Utilities
 *
 * Provides a type-safe mock for Prisma Client used across all tests.
 * This allows us to test service layer logic without hitting the database.
 */

import { PrismaClient } from '@prisma/client'
import { beforeEach } from 'vitest'
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'

// Create a deep mock of PrismaClient with full type safety
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>

// Reset all mocks before each test to ensure test isolation
beforeEach(() => {
  mockReset(prismaMock)
})

// Export type for use in tests
export type PrismaMock = typeof prismaMock
