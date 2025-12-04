/**
 * Mahad Fake Student Seed Script
 *
 * Generates fake Mahad students for testing purposes.
 * All fake data is marked with metadata for safe cleanup.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/seed-mahad-fake.ts count  # Show count
 */

import {
  Gender,
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Program,
  StudentBillingType,
} from '@prisma/client'

import { prisma } from '@/lib/db'

const FAKE_DATA_MARKER = { isFakeData: true, seedVersion: 'v1' }

const FIRST_NAMES_MALE = [
  'Ahmad',
  'Mohamed',
  'Ibrahim',
  'Yusuf',
  'Omar',
  'Ali',
  'Hassan',
  'Abdullahi',
  'Ismail',
  'Khalid',
  'Abdirahman',
  'Hamza',
  'Bilal',
  'Zakariya',
  'Idris',
]

const FIRST_NAMES_FEMALE = [
  'Fatima',
  'Amina',
  'Khadija',
  'Zahra',
  'Maryam',
  'Aisha',
  'Halima',
  'Sumaya',
  'Hawa',
  'Nadia',
  'Ruqaya',
  'Safiya',
  'Yasmin',
  'Layla',
  'Iman',
]

const LAST_NAMES = [
  'Hassan',
  'Ali',
  'Mohamed',
  'Omar',
  'Ibrahim',
  'Yusuf',
  'Abdi',
  'Ahmed',
  'Hussein',
  'Farah',
  'Nur',
  'Adan',
  'Jama',
  'Warsame',
  'Elmi',
]

const SCHOOL_NAMES = [
  'Roosevelt High School',
  'Edison High School',
  'South High School',
  'Washburn High School',
  'Patrick Henry High School',
  'University of Minnesota',
  'Minneapolis Community College',
  'Normandale Community College',
  'Metro State University',
  'St. Thomas University',
]

const GRADE_LEVELS = [
  GradeLevel.FRESHMAN,
  GradeLevel.SOPHOMORE,
  GradeLevel.JUNIOR,
  GradeLevel.SENIOR,
]

const BILLING_TYPES = [
  StudentBillingType.FULL_TIME,
  StudentBillingType.FULL_TIME,
  StudentBillingType.FULL_TIME,
  StudentBillingType.FULL_TIME_SCHOLARSHIP,
  StudentBillingType.PART_TIME,
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(minAge: number, maxAge: number): Date {
  const now = new Date()
  const minYear = now.getFullYear() - maxAge
  const maxYear = now.getFullYear() - minAge
  const year = randomInt(minYear, maxYear)
  const month = randomInt(0, 11)
  const day = randomInt(1, 28)
  return new Date(year, month, day)
}

function generateFakePhone(): string {
  const areaCode = randomFrom(['612', '651', '763', '952'])
  const exchange = randomInt(200, 999)
  const subscriber = randomInt(1000, 9999)
  return `+1${areaCode}${exchange}${subscriber}`
}

interface FakeStudent {
  firstName: string
  lastName: string
  fullName: string
  gender: Gender
  dateOfBirth: Date
  email: string
  phone: string
  graduationStatus: GraduationStatus
  gradeLevel: GradeLevel | null
  billingType: StudentBillingType
  paymentFrequency: PaymentFrequency
  schoolName: string | null
}

function generateFakeStudent(index: number): FakeStudent {
  const gender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE
  const firstName =
    gender === Gender.MALE
      ? randomFrom(FIRST_NAMES_MALE)
      : randomFrom(FIRST_NAMES_FEMALE)
  const lastName = randomFrom(LAST_NAMES)
  const fullName = `${firstName} ${lastName}`

  const graduationStatus =
    Math.random() > 0.3
      ? GraduationStatus.NON_GRADUATE
      : GraduationStatus.GRADUATE

  const gradeLevel =
    graduationStatus === GraduationStatus.NON_GRADUATE
      ? randomFrom(GRADE_LEVELS)
      : null

  const schoolName =
    graduationStatus === GraduationStatus.NON_GRADUATE
      ? randomFrom(SCHOOL_NAMES)
      : null

  const dateOfBirth =
    graduationStatus === GraduationStatus.NON_GRADUATE
      ? randomDate(14, 19)
      : randomDate(20, 28)

  const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}`
  const email = `${emailBase}@test.irshad.edu`

  return {
    firstName,
    lastName,
    fullName,
    gender,
    dateOfBirth,
    email,
    phone: generateFakePhone(),
    graduationStatus,
    gradeLevel,
    billingType: randomFrom(BILLING_TYPES),
    paymentFrequency: randomFrom([
      PaymentFrequency.MONTHLY,
      PaymentFrequency.BI_MONTHLY,
    ]),
    schoolName,
  }
}

async function seedFakeStudents(count: number): Promise<void> {
  console.log(`Creating ${count} fake Mahad students...`)

  let created = 0
  const errors: { name: string; error: string }[] = []

  for (let i = 0; i < count; i++) {
    const student = generateFakeStudent(i + 1)

    try {
      await prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            name: student.fullName,
            dateOfBirth: student.dateOfBirth,
          },
        })

        await tx.contactPoint.createMany({
          data: [
            {
              personId: person.id,
              type: 'EMAIL',
              value: student.email,
              isPrimary: true,
            },
            {
              personId: person.id,
              type: 'PHONE',
              value: student.phone,
              isPrimary: false,
            },
          ],
        })

        const profile = await tx.programProfile.create({
          data: {
            personId: person.id,
            program: Program.MAHAD_PROGRAM,
            status: 'REGISTERED',
            gender: student.gender,
            graduationStatus: student.graduationStatus,
            gradeLevel: student.gradeLevel,
            billingType: student.billingType,
            paymentFrequency: student.paymentFrequency,
            schoolName: student.schoolName,
            metadata: FAKE_DATA_MARKER,
          },
        })

        await tx.enrollment.create({
          data: {
            programProfileId: profile.id,
            status: 'REGISTERED',
            startDate: new Date(),
          },
        })
      })

      created++
      console.log(`  [${created}/${count}] Created: ${student.fullName}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ name: student.fullName, error: message })
      console.error(`  Failed: ${student.fullName} - ${message}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Created: ${created}/${count}`)
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`)
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`))
  }
}

async function cleanFakeStudents(): Promise<void> {
  console.log('Finding fake students to remove...')

  const fakeProfiles = await prisma.programProfile.findMany({
    where: {
      metadata: {
        path: ['isFakeData'],
        equals: true,
      },
    },
    select: {
      id: true,
      personId: true,
      person: {
        select: { name: true },
      },
    },
  })

  if (fakeProfiles.length === 0) {
    console.log('No fake students found.')
    return
  }

  console.log(`Found ${fakeProfiles.length} fake students. Removing...`)

  const personIds = fakeProfiles.map((p) => p.personId)

  await prisma.$transaction(async (tx) => {
    const profileIds = fakeProfiles.map((p) => p.id)
    await tx.enrollment.deleteMany({
      where: { programProfileId: { in: profileIds } },
    })

    await tx.programProfile.deleteMany({
      where: { id: { in: profileIds } },
    })

    await tx.contactPoint.deleteMany({
      where: { personId: { in: personIds } },
    })

    await tx.person.deleteMany({
      where: { id: { in: personIds } },
    })
  })

  console.log(`Removed ${fakeProfiles.length} fake students:`)
  fakeProfiles.forEach((p) => console.log(`  - ${p.person.name}`))
}

async function countFakeStudents(): Promise<void> {
  const count = await prisma.programProfile.count({
    where: {
      metadata: {
        path: ['isFakeData'],
        equals: true,
      },
    },
  })

  console.log(`Fake Mahad students in database: ${count}`)
}

async function main(): Promise<void> {
  const command = process.argv[2]

  switch (command) {
    case 'seed':
      await seedFakeStudents(25)
      break
    case 'clean':
      await cleanFakeStudents()
      break
    case 'count':
      await countFakeStudents()
      break
    default:
      console.log('Mahad Fake Student Seed Script')
      console.log('')
      console.log('Usage:')
      console.log(
        '  node --env-file=.env.local --import tsx scripts/seed-mahad-fake.ts seed   # Create 25 fake students'
      )
      console.log(
        '  node --env-file=.env.local --import tsx scripts/seed-mahad-fake.ts clean  # Remove all fake students'
      )
      console.log(
        '  node --env-file=.env.local --import tsx scripts/seed-mahad-fake.ts count  # Show count'
      )
  }
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
