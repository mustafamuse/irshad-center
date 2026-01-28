import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_MARKER = '[SEED]'

function assertNotProduction() {
  const dbUrl = process.env.DATABASE_URL || ''
  if (dbUrl.includes('prod') || process.env.NODE_ENV === 'production') {
    console.error(
      'SAFETY CHECK FAILED: Cannot run seed scripts against production database'
    )
    process.exit(1)
  }
}

async function unseedAttendance() {
  assertNotProduction()
  console.log('Removing seeded attendance data...\n')

  const result = await prisma.dugsiAttendanceSession.deleteMany({
    where: { notes: SEED_MARKER },
  })

  console.log(
    `Deleted ${result.count} seeded sessions (cascade deletes records).`
  )
}

unseedAttendance()
  .catch((e) => {
    console.error('Unseed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
