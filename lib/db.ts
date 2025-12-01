import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Single client using pooled connection (DATABASE_URL)
// The directUrl in schema.prisma is used by Prisma CLI only (migrations)
// See: https://supabase.com/docs/guides/database/prisma
const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export { prisma }
