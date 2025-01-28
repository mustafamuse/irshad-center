import { prisma } from '@/lib/db'

import studentsDataRaw from '../lib/data/students.json'
interface StudentData {
  id: string
  name: string
  className: string
  monthlyRate: number
  hasCustomRate: boolean
  familyId: string | null
  siblings: string[]
  totalFamilyMembers: number
}

interface StudentsData {
  students: { [key: string]: StudentData }
  constants: {
    baseRate: number
    discounts: {
      siblings: Record<string, number>
    }
  }
}

const studentsData = studentsDataRaw as StudentsData

async function dropTables() {
  console.log('❌ Dropping all table data...')

  // Drop tables in order based on foreign key relationships
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "_ClassGroupToStudent"`, // many-to-many
    prisma.student.deleteMany(),
    prisma.familyGroup.deleteMany(),
    prisma.classGroup.deleteMany(),
  ])

  console.log('✅ All table data has been cleared.')
}

async function seedData() {
  console.log('🌱 Starting seed...')

  const familyGroupMap = new Map<string, string>()
  const classGroupMap = new Map<string, string>()

  let familyGroupCount = 0
  let classGroupCount = 0
  let studentCount = 0

  for (const studentName of Object.keys(studentsData.students)) {
    const student = studentsData.students[studentName]

    // Handle Family Groups
    let familyGroupId: string | null = null
    if (student.familyId) {
      if (!familyGroupMap.has(student.familyId)) {
        const familyGroup = await prisma.familyGroup.create({
          data: {},
        })
        familyGroupMap.set(student.familyId, familyGroup.id)
        familyGroupId = familyGroup.id

        familyGroupCount++
        console.log(`✅ Created family group with ID: ${familyGroup.id}`)
      } else {
        familyGroupId = familyGroupMap.get(student.familyId) ?? null
      }
    }

    // Handle Class Groups
    let classGroupId: string | null = null
    if (student.className) {
      if (!classGroupMap.has(student.className)) {
        const classGroup = await prisma.classGroup.create({
          data: {
            name: student.className,
          },
        })
        classGroupMap.set(student.className, classGroup.id)
        classGroupId = classGroup.id

        classGroupCount++
        console.log(`✅ Created class group: ${student.className}`)
      } else {
        classGroupId = classGroupMap.get(student.className) ?? null
      }
    }

    // Create Student
    await prisma.student.create({
      data: {
        name: student.name,
        className: student.className,
        monthlyRate: student.monthlyRate,
        customRate: student.hasCustomRate,
        discountApplied:
          studentsData.constants.baseRate - student.monthlyRate || 0,
        familyGroup: familyGroupId
          ? { connect: { id: familyGroupId } }
          : undefined,
        classGroups: {
          connect: classGroupId ? [{ id: classGroupId }] : [],
        },
      },
    })

    studentCount++
    console.log(
      `✅ Created student: ${student.name}, Class: ${student.className}, Family ID: ${
        familyGroupId || 'No Family'
      }, Monthly Rate: ${student.monthlyRate}, Custom Rate: ${
        student.hasCustomRate ? 'Yes' : 'No'
      }`
    )
  }

  console.log('🌟 Seeding Summary:')
  console.log(`👪 Family Groups created: ${familyGroupCount}`)
  console.log(`📚 Class Groups created: ${classGroupCount}`)
  console.log(`🎓 Students created: ${studentCount}`)
  console.log('✅ Seeding complete!')
}

async function main() {
  await dropTables()
  await seedData()
}

// Run the seeding script as CLI
main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    // Only disconnect here because we're done with the CLI run
    await prisma.$disconnect()
  })
