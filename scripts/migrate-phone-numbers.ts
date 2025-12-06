import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/types/person'

async function migratePhoneNumbers() {
  console.log('Starting phone number migration...\n')

  const allPhones = await prisma.contactPoint.findMany({
    where: {
      type: { in: ['PHONE', 'WHATSAPP'] },
      isActive: true,
    },
    include: {
      person: {
        select: {
          name: true,
        },
      },
    },
  })

  console.log(`Total active phone/WhatsApp numbers: ${allPhones.length}`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const phone of allPhones) {
    const normalized = normalizePhone(phone.value)

    if (!normalized) {
      console.log(`⚠️  Invalid phone for ${phone.person.name}: ${phone.value}`)
      errors++
      continue
    }

    if (normalized === phone.value) {
      skipped++
      continue
    }

    try {
      await prisma.contactPoint.update({
        where: { id: phone.id },
        data: { value: normalized },
      })

      console.log(`✓ ${phone.person.name}: ${phone.value} → ${normalized}`)
      updated++
    } catch (error) {
      console.error(
        `✗ Failed to update ${phone.person.name}: ${phone.value}`,
        error instanceof Error ? error.message : 'Unknown error'
      )
      errors++
    }
  }

  console.log('\n=== Migration Summary ===')
  console.log(`Total processed: ${allPhones.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (already normalized): ${skipped}`)
  console.log(`Errors: ${errors}`)

  await prisma.$disconnect()
}

migratePhoneNumbers()
