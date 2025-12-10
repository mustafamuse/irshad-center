/**
 * Database Client Type Helpers
 *
 * Provides type-safe helpers for supporting both standalone Prisma client
 * and transaction client contexts.
 */

import { PrismaClient } from '@prisma/client'

/**
 * Transaction client type - the client passed to $transaction callback
 */
export type TransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0]

/**
 * Type representing either the global Prisma client or a transaction client
 *
 * Usage in query functions:
 * ```typescript
 * export async function myQuery(
 *   params: {...},
 *   client: DatabaseClient = prisma
 * ) {
 *   return client.model.findMany({...})
 * }
 * ```
 *
 * Benefits:
 * - Functions work both standalone and within transactions
 * - Type-safe (TypeScript validates client methods exist)
 * - Backward compatible (client parameter is optional with default)
 * - Enables proper transaction isolation
 */
export type DatabaseClient = PrismaClient | TransactionClient

/**
 * Type guard to check if a client is a transaction client (no $transaction method)
 *
 * Note: This is primarily for runtime checks if needed.
 * In most cases, the type system handles this automatically.
 */
export function isTransactionClient(
  client: DatabaseClient
): client is TransactionClient {
  // Transaction clients don't have $transaction method
  return !('$transaction' in client)
}

/**
 * Type guard to check if a client is the full Prisma client (has $transaction method)
 */
export function isPrismaClient(client: DatabaseClient): client is PrismaClient {
  return '$transaction' in client
}
