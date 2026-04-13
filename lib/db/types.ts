import { PrismaClient } from '@prisma/client'

export type TransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0]

// Accepts both the global Prisma client and a transaction client.
// Use as an optional parameter with `= prisma` so callers work standalone or inside a transaction.
export type DatabaseClient = PrismaClient | TransactionClient

export function isTransactionClient(
  client: DatabaseClient
): client is TransactionClient {
  return !('$transaction' in client)
}

export function isPrismaClient(client: DatabaseClient): client is PrismaClient {
  return '$transaction' in client
}
