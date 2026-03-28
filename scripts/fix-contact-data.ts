import { prisma } from '@/lib/db'

const dryRun = process.argv.includes('--dry-run')

async function fixContactData() {
  if (dryRun) console.log('*** DRY RUN — no writes will be performed ***\n')
  console.log('=== Contact Data Fix Script ===\n')

  console.log('--- Fix 1: Strip leading 1 from 11-digit NANP phones ---')
  const phones = await prisma.contactPoint.findMany({
    where: { type: 'PHONE', isActive: true },
    include: { person: { select: { name: true } } },
  })

  const elevenDigit = phones.filter(
    (p) => p.value.length === 11 && p.value.startsWith('1')
  )
  console.log(`Found ${elevenDigit.length} eleven-digit NANP phones`)

  let phonesUpdated = 0
  let phonesSkipped = 0
  let phonesDeactivated = 0

  for (const phone of elevenDigit) {
    const stripped = phone.value.slice(1)

    try {
      await prisma.$transaction(async (tx) => {
        const collision = await tx.contactPoint.findFirst({
          where: {
            personId: phone.personId,
            type: 'PHONE',
            value: stripped,
            isActive: true,
          },
        })

        if (collision) {
          if (!dryRun) {
            await tx.contactPoint.update({
              where: { id: phone.id },
              data: { isActive: false, deactivatedAt: new Date() },
            })
          }
          console.log(
            `  ${dryRun ? '[DRY] Would deactivate' : 'Deactivated'} ${phone.person.name}: ${phone.value} (collision with existing ${stripped})`
          )
          phonesDeactivated++
        } else {
          if (!dryRun) {
            await tx.contactPoint.update({
              where: { id: phone.id },
              data: { value: stripped },
            })
          }
          console.log(
            `  ${dryRun ? '[DRY] Would update' : 'Updated'} ${phone.person.name}: ${phone.value} -> ${stripped}`
          )
          phonesUpdated++
        }
      })
    } catch (error) {
      console.error(
        `  Failed ${phone.person.name}: ${phone.value}`,
        error instanceof Error ? error.message : 'Unknown error'
      )
      phonesSkipped++
    }
  }

  console.log(
    `  Result: ${phonesUpdated} updated, ${phonesDeactivated} deactivated, ${phonesSkipped} errors\n`
  )

  // Fix 2: Set isPrimary=true on emails with isPrimary=false
  console.log('--- Fix 2: Fix emails with isPrimary=false ---')
  const emailCount = await prisma.contactPoint.count({
    where: { type: 'EMAIL', isPrimary: false, isActive: true },
  })
  if (!dryRun && emailCount > 0) {
    await prisma.contactPoint.updateMany({
      where: { type: 'EMAIL', isPrimary: false, isActive: true },
      data: { isPrimary: true },
    })
  }
  console.log(
    `  ${dryRun ? `[DRY] Would update ${emailCount}` : `Updated ${emailCount}`} emails to isPrimary=true\n`
  )

  // Fix 3: Set isPrimary=true on phones with isPrimary=false
  console.log('--- Fix 3: Fix phones with isPrimary=false ---')
  const phoneCount = await prisma.contactPoint.count({
    where: { type: 'PHONE', isPrimary: false, isActive: true },
  })
  if (!dryRun && phoneCount > 0) {
    await prisma.contactPoint.updateMany({
      where: { type: 'PHONE', isPrimary: false, isActive: true },
      data: { isPrimary: true },
    })
  }
  console.log(
    `  ${dryRun ? `[DRY] Would update ${phoneCount}` : `Updated ${phoneCount}`} phones to isPrimary=true\n`
  )

  console.log('=== Verification ===')
  const summary = await prisma.$queryRaw<
    Array<{ type: string; isPrimary: boolean; count: number }>
  >`
    SELECT type, "isPrimary", COUNT(*)::int as count
    FROM "ContactPoint"
    WHERE "isActive" = true
    GROUP BY type, "isPrimary"
    ORDER BY type, "isPrimary"
  `
  for (const row of summary) {
    console.log(`  ${row.type} isPrimary=${row.isPrimary}: ${row.count}`)
  }

  const badLengths = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int as count
    FROM "ContactPoint"
    WHERE type = 'PHONE' AND "isActive" = true AND LENGTH(value) != 10
  `
  console.log(`  Phones with non-10-digit length: ${badLengths[0].count}`)

  console.log('\n=== Done ===')
  await prisma.$disconnect()
}

fixContactData().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
