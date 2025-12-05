const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n=== Searching for contact: dahoom2600@gmail.com ===')
  const emailContacts = await prisma.contactPoint.findMany({
    where: {
      type: 'EMAIL',
      value: 'dahoom2600@gmail.com',
    },
    include: {
      person: {
        include: {
          teacher: true,
        },
      },
    },
  })

  console.log(`Found ${emailContacts.length} contact(s) with this email:`)
  emailContacts.forEach((contact, i) => {
    console.log(`\n[${i + 1}] Contact ID: ${contact.id}`)
    console.log(`    isActive: ${contact.isActive}`)
    console.log(`    Person: ${contact.person.name} (ID: ${contact.person.id})`)
    console.log(
      `    Is Teacher: ${contact.person.teacher ? 'Yes (Teacher ID: ' + contact.person.teacher.id + ')' : 'No'}`
    )
  })

  console.log('\n=== Searching for contact: +1 (619) 673-2720 ===')
  const phoneContacts = await prisma.contactPoint.findMany({
    where: {
      type: 'PHONE',
      value: '+1 (619) 673-2720',
    },
    include: {
      person: {
        include: {
          teacher: true,
        },
      },
    },
  })

  console.log(`Found ${phoneContacts.length} contact(s) with this phone:`)
  phoneContacts.forEach((contact, i) => {
    console.log(`\n[${i + 1}] Contact ID: ${contact.id}`)
    console.log(`    isActive: ${contact.isActive}`)
    console.log(`    Person: ${contact.person.name} (ID: ${contact.person.id})`)
    console.log(
      `    Is Teacher: ${contact.person.teacher ? 'Yes (Teacher ID: ' + contact.person.teacher.id + ')' : 'No'}`
    )
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
