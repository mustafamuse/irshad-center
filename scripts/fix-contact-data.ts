import { prisma } from '@/lib/db'

async function fixContactData() {
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

    const collision = await prisma.contactPoint.findFirst({
      where: {
        personId: phone.personId,
        type: 'PHONE',
        value: stripped,
        isActive: true,
      },
    })

    if (collision) {
      await prisma.contactPoint.update({
        where: { id: phone.id },
        data: { isActive: false, deactivatedAt: new Date() },
      })
      console.log(
        `  Deactivated ${phone.person.name}: ${phone.value} (collision with existing ${stripped})`
      )
      phonesDeactivated++
      continue
    }

    try {
      await prisma.contactPoint.update({
        where: { id: phone.id },
        data: { value: stripped },
      })
      console.log(
        `  Updated ${phone.person.name}: ${phone.value} -> ${stripped}`
      )
      phonesUpdated++
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
  const emailFix = await prisma.contactPoint.updateMany({
    where: { type: 'EMAIL', isPrimary: false, isActive: true },
    data: { isPrimary: true },
  })
  console.log(`  Updated ${emailFix.count} emails to isPrimary=true\n`)

  // Fix 3: Set isPrimary=true on phones with isPrimary=false
  console.log('--- Fix 3: Fix phones with isPrimary=false ---')
  const phoneFix = await prisma.contactPoint.updateMany({
    where: { type: 'PHONE', isPrimary: false, isActive: true },
    data: { isPrimary: true },
  })
  console.log(`  Updated ${phoneFix.count} phones to isPrimary=true\n`)

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
