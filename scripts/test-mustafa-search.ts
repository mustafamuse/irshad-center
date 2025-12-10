import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/types/person'

async function testMustafaSearch() {
  console.log('Testing Mustafa Muse search scenarios...\n')

  console.log('=== Test 1: Search by name "Mustafa Muse" ===')
  const byName = await prisma.person.findMany({
    where: {
      name: { contains: 'Mustafa Muse', mode: 'insensitive' },
    },
    include: {
      contactPoints: {
        where: { isActive: true },
      },
      teacher: true,
    },
  })

  console.log(`Found ${byName.length} person(s)`)
  byName.forEach((person) => {
    console.log(`  Name: ${person.name}`)
    console.log(
      `  Email: ${person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value || 'None'}`
    )
    console.log(
      `  Phone: ${person.contactPoints.find((cp) => cp.type === 'PHONE')?.value || 'None'}`
    )
    console.log(`  Is Teacher: ${!!person.teacher}`)
    console.log()
  })

  console.log('=== Test 2: Search by phone "7633469093" (normalized) ===')
  const userInputPhone = '7633469093'
  const normalizedUserPhone = normalizePhone(userInputPhone)
  console.log(
    `User input: ${userInputPhone} → Normalized: ${normalizedUserPhone}\n`
  )

  const byUserPhone = await prisma.person.findMany({
    where: {
      contactPoints: {
        some: {
          type: { in: ['PHONE', 'WHATSAPP'] },
          value: normalizedUserPhone || userInputPhone,
        },
      },
    },
    include: {
      contactPoints: {
        where: { isActive: true },
      },
    },
  })

  console.log(
    `Found ${byUserPhone.length} person(s) with phone ${normalizedUserPhone}`
  )
  byUserPhone.forEach((person) => {
    console.log(`  Name: ${person.name}`)
    console.log(
      `  Email: ${person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value || 'None'}`
    )
    console.log(
      `  Phone: ${person.contactPoints.find((cp) => cp.type === 'PHONE')?.value || 'None'}`
    )
    console.log()
  })

  // Test 3: Search by actual phone in DB (763-346-0937 → 7633460937)
  console.log(
    '=== Test 3: Search by actual phone "763-346-0937" (normalized) ==='
  )
  const actualPhone = '763-346-0937'
  const normalizedActualPhone = normalizePhone(actualPhone)
  console.log(
    `DB phone: ${actualPhone} → Normalized: ${normalizedActualPhone}\n`
  )

  const byActualPhone = await prisma.person.findMany({
    where: {
      contactPoints: {
        some: {
          type: { in: ['PHONE', 'WHATSAPP'] },
          value: normalizedActualPhone || actualPhone,
        },
      },
    },
    include: {
      contactPoints: {
        where: { isActive: true },
      },
    },
  })

  console.log(
    `Found ${byActualPhone.length} person(s) with phone ${normalizedActualPhone}`
  )
  byActualPhone.forEach((person) => {
    console.log(`  Name: ${person.name}`)
    console.log(
      `  Email: ${person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value || 'None'}`
    )
    console.log(
      `  Phone: ${person.contactPoints.find((cp) => cp.type === 'PHONE')?.value || 'None'}`
    )
    console.log()
  })

  // Test 4: All Mustafa Muse phone numbers
  console.log('=== Test 4: All phone numbers for Mustafa Muse ===')
  const mustafaPhones = await prisma.contactPoint.findMany({
    where: {
      person: {
        name: { contains: 'Mustafa Muse', mode: 'insensitive' },
      },
      type: { in: ['PHONE', 'WHATSAPP'] },
      isActive: true,
    },
    include: {
      person: {
        select: { name: true },
      },
    },
  })

  mustafaPhones.forEach((cp) => {
    console.log(`  ${cp.person.name}: ${cp.value}`)
  })

  await prisma.$disconnect()
}

testMustafaSearch()
