/**
 * Type definitions for Dugsi webhook test helpers
 */

import { vi } from 'vitest'

/**
 * ProgramProfile data type for test mocks
 */
export interface TestProgramProfile {
  id: string
  personId: string
  program: string
  familyReferenceId?: string | null
  person?: {
    id: string
    name: string
  }
}

/**
 * Guardian relationship data for test mocks
 */
export interface TestGuardianRelationship {
  id: string
  guardianId: string
  dependentId: string
  guardian: {
    id: string
    name: string
    contactPoints: Array<{
      id: string
      type: string
      value: string
    }>
  }
}

/**
 * Transaction spies returned by buildPrismaProfileTxMock
 */
export interface TransactionSpies {
  programProfile: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
  guardianRelationship: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
  }
  person: {
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  contactPoint: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  billingAccount: {
    findFirst: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  subscription: {
    findFirst: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  billingAssignment: {
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  enrollment: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

/**
 * Transaction mock builder options
 */
export interface TransactionMockOptions {
  profiles?: TestProgramProfile[]
  updateCount?: number
}
