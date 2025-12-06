import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/types/person'

async function checkPhoneNormalization() {
  console.log('Checking for unnormalized phone numbers...\n')

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

  const unnormalized = allPhones.filter((phone) => {
    const normalized = normalizePhone(phone.value)
    return normalized && normalized !== phone.value
  })

  console.log(`Unnormalized phone numbers: ${unnormalized.length}\n`)

  if (unnormalized.length > 0) {
    console.log('Examples of unnormalized phones:')
    unnormalized.slice(0, 10).forEach((phone) => {
      const normalized = normalizePhone(phone.value)
      console.log(`  ${phone.person.name}: ${phone.value} → ${normalized}`)
    })

    console.log('\nMigration script is needed.')
  } else {
    console.log(
      'All phone numbers are already normalized. No migration needed.'
    )
  }

  await prisma.$disconnect()
}

checkPhoneNormalization()
