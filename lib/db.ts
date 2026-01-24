import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined
}

const connectionString = process.env.DATABASE_URL

const pool = global.pgPool || new Pool({ connectionString })

if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool
}

const adapter = new PrismaPg(pool)

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
