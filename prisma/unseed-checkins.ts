import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_MARKER = '[SEED]'

async function unseedCheckins() {
  console.log('Removing seeded check-in data...\n')

  const count = await prisma.dugsiTeacherCheckIn.count({
    where: { notes: SEED_MARKER },
  })

  if (count === 0) {
    console.log('No seeded check-in records found.')
    return
  }

  console.log(`Found ${count} seeded records to delete.`)

  const result = await prisma.dugsiTeacherCheckIn.deleteMany({
    where: { notes: SEED_MARKER },
  })

  console.log(`\nDeleted ${result.count} seeded check-in records.`)
  console.log('Production data is untouched.')
}

unseedCheckins()
  .catch((e) => {
    console.error('Unseed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
