import { PrismaClient } from '@prisma/client'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var prismaDirectClient: PrismaClient | undefined
}

// Primary client - uses PgBouncer (DATABASE_URL) for connection pooling
const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Direct client - bypasses PgBouncer for interactive transactions
// Uses DIRECT_URL (port 5432) instead of DATABASE_URL (port 6543)
// Required for operations using $transaction(async (tx) => {...})
const prismaDirectClient =
  global.prismaDirectClient ||
  new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: (() => {
          if (!process.env.DIRECT_URL) {
            throw new Error(
              'DIRECT_URL is required for interactive transactions. ' +
                'Add DIRECT_URL to .env pointing to port 5432 (bypassing PgBouncer)'
            )
          }
          return process.env.DIRECT_URL
        })(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
  global.prismaDirectClient = prismaDirectClient
}

export { prisma, prismaDirectClient }
