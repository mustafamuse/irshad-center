import { ContactType } from '@prisma/client'

import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/types/person'

async function testSearchAction(query: string) {
  console.log(`\n=== Searching for: "${query}" ===`)

  const searchTerm = query.trim().toLowerCase()
  const normalizedSearchTerm = normalizePhone(query.trim())

  if (normalizedSearchTerm) {
    console.log(`Normalized phone: ${normalizedSearchTerm}`)
  }

  const people = await prisma.person.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        {
          contactPoints: {
            some: {
              OR: [
                {
                  type: 'EMAIL',
                  value: { contains: searchTerm, mode: 'insensitive' },
                },
                ...(normalizedSearchTerm
                  ? [
                      {
                        type: { in: ['PHONE', 'WHATSAPP'] as ContactType[] },
                        value: normalizedSearchTerm,
                      },
                    ]
                  : []),
              ],
            },
          },
        },
      ],
    },
    include: {
      contactPoints: {
        where: { isActive: true },
      },
      teacher: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${people.length} result(s)`)
  people.forEach((person) => {
    console.log(`  - ${person.name}`)
    console.log(
      `    Email: ${person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value || 'None'}`
    )
    console.log(
      `    Phone: ${person.contactPoints.find((cp) => cp.type === 'PHONE')?.value || 'None'}`
    )
    console.log(`    Is Teacher: ${!!person.teacher}`)
  })
}

async function runTests() {
  console.log('Testing search functionality with normalization fixes...')

  // Test 1: Search by formatted phone (should find after normalization)
  await testSearchAction('763-346-0937')

  // Test 2: Search by digits-only phone (should find after normalization)
  await testSearchAction('7633460937')

  // Test 3: Search by non-existent phone
  await testSearchAction('7633469093')

  // Test 4: Search by email
  await testSearchAction('umpp101@gmail.com')

  // Test 5: Search by partial email
  await testSearchAction('umpp176')

  // Test 6: Search by name
  await testSearchAction('Mustafa')

  await prisma.$disconnect()
  console.log('\n✓ All search tests completed')
}

runTests()
