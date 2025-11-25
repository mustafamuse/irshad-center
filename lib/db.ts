import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

import { dbLogger } from './logger'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Create PostgreSQL connection pool for the adapter
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Optimized pool configuration for serverless (Vercel) + PgBouncer
// - max: 1 prevents connection exhaustion (100 functions × 1 = 100 connections, within PgBouncer limits)
// - idleTimeoutMillis: 30s releases connections quickly in serverless cold starts
// - connectionTimeoutMillis: 5s prevents hanging queries
const pool = new Pool({
  connectionString,
  max: 1, // Serverless-optimized: low pool size per function
  idleTimeoutMillis: 30000, // 30 seconds before closing idle connections
  connectionTimeoutMillis: 5000, // 5 second timeout for acquiring connections
})

// Connection pool event logging for monitoring and debugging
pool.on('connect', () => {
  dbLogger.info('Database connection established')
})

pool.on('error', (err) => {
  dbLogger.error({ err }, 'Unexpected error on idle client')
})

pool.on('remove', () => {
  dbLogger.info('Connection removed from pool')
})

const adapter = new PrismaPg(pool)

// In production, we don't want to pollute the global scope.
// So we create a new PrismaClient once.
const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export { prisma }
