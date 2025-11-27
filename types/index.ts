/**
 * Shared Types
 *
 * Note: Student types have been migrated to the new schema.
 * See lib/db/prisma-helpers.ts for the new normalized types.
 */

export type SearchParams = {
  [key: string]: string | string[] | undefined
}

/**
 * @deprecated Use the new normalized types from lib/db/prisma-helpers.ts
 * This type is kept for backward compatibility with legacy components.
 * Made flexible to support both old and new data formats during migration.
 */
export type StudentWithDetails = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
  Batch: {
    id: string
    name: string
  } | null
  // New StudentPayment format (from schema)
  StudentPayment: Array<{
    id: string
    programProfileId: string
    year: number
    month: number
    amountPaid: number
    paidAt: Date
    stripeInvoiceId: string | null
  }>
  subscriptionMembers?: Array<{
    id: string
    name: string
  }>
  batchId?: string | null
  // Optional fields from old schema (for backward compat)
  dateOfBirth?: Date | null
  createdAt?: Date
  updatedAt?: Date
  batch?: {
    id: string
    name: string
  } | null
  payments?: Array<{
    id: string
    amount: number
    createdAt: Date
  }>
}
