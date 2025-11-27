import { GradeLevel, GraduationStatus, Program } from '@prisma/client'
import csvParser from 'csv-parser'
import * as fs from 'fs'

import { prisma } from '@/lib/db'

// ============================================================================
// CSV Row Type Definition
// ============================================================================

/**
 * Type definition for Mahad batch CSV import rows
 * Matches the expected columns from the CSV file
 */
interface MahadCSVRow {
  'First Name:': string
  'Last Name:': string
  'Date of Birth': string
  'Current School level': string
  'Grade/Year': string
  'Name of School/College/University': string
  'Email Address:': string
  'Phone Number: WhatsApp': string
}

/**
 * Processed student data ready for database insertion
 */
interface ProcessedStudent {
  fullName: string
  dateOfBirth: Date | null
  graduationStatus: GraduationStatus | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  email: string | null
  phone: string | null
}

// Formatting functions
function capitalizeWords(str: string): string {
  if (!str) return ''
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatPhoneNumber(phone: string | null): string | null {
  if (!phone) return null

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Check if it's a 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}` // E.164 format for US numbers
  }

  // If it's not a standard US number, return the original input
  return phone
}

function formatSchoolName(name: string | null): string | null {
  if (!name) return null

  // Common abbreviations to handle
  const abbreviations = ['hs', 'ms', 'jr', 'sr', 'ii', 'iii', 'iv']

  return name
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase()
      // Keep abbreviations uppercase
      if (abbreviations.includes(lower)) {
        return word.toUpperCase()
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

async function dropTables() {
  console.log('❌ Dropping all table data...')

  // Drop tables in order based on foreign key relationships
  // Order matters: child tables first, then parent tables
  await prisma.$transaction([
    // Billing & Payments
    prisma.studentPayment.deleteMany(),
    prisma.billingAssignment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.billingAccount.deleteMany(),

    // Enrollments & Profiles
    prisma.enrollment.deleteMany(),
    prisma.programProfile.deleteMany(),

    // Relationships
    prisma.siblingRelationship.deleteMany(),
    prisma.guardianRelationship.deleteMany(),

    // Contact & Person
    prisma.contactPoint.deleteMany(),
    prisma.person.deleteMany(),

    // Batches & Teachers
    prisma.batch.deleteMany(),
    prisma.teacher.deleteMany(),
  ])

  console.log('✅ All table data has been cleared.')
}

/**
 * Calculate age based on a given birth date.
 * Currently unused but kept for future graduation logic.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }
  return age
}

/**
 * Map the CSV "Current School level" value to GraduationStatus.
 * Returns:
 *  - NON_GRADUATE if still in school (high school or college)
 *  - GRADUATE if graduated/not in school
 */
function mapGraduationStatus(level: string): GraduationStatus | null {
  if (!level) return null
  const lvl = level.trim().toLowerCase()
  if (lvl === 'college' || lvl === 'highschool' || lvl === 'high school') {
    return GraduationStatus.NON_GRADUATE
  } else if (lvl === 'graduated' || lvl === 'graduate') {
    return GraduationStatus.GRADUATE
  }
  return null
}

/**
 * Map the CSV "Grade/Year" value to the GradeLevel enum.
 * For values like "Freshman", "Sophomore", "Junior", "Senior" we return the corresponding enum.
 * If the value is "Graduated" or "Graduate", we return null so we can mark graduation booleans separately.
 */
function mapGradeLevel(grade: string): GradeLevel | null {
  if (!grade) return null
  const g = grade.trim().toLowerCase()
  if (g === 'freshman') return GradeLevel.FRESHMAN
  if (g === 'sophomore') return GradeLevel.SOPHOMORE
  if (g === 'junior') return GradeLevel.JUNIOR
  if (g === 'senior') return GradeLevel.SENIOR
  return null
}

/**
 * Parse a CSV file and return an array of typed row objects.
 */
function parseCSV(filePath: string): Promise<MahadCSVRow[]> {
  return new Promise((resolve, reject) => {
    const results: MahadCSVRow[] = []
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data: MahadCSVRow) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err))
  })
}

/**
 * Process a CSV row into a structured student object
 */
function processCSVRow(row: MahadCSVRow): ProcessedStudent {
  const firstName = capitalizeWords(row['First Name:']?.trim() || '')
  const lastName = capitalizeWords(row['Last Name:']?.trim() || '')
  const fullName = `${firstName} ${lastName}`

  const dobValue = row['Date of Birth']?.trim()
  const dateOfBirth = dobValue ? new Date(dobValue) : null

  const schoolLevelRaw = row['Current School level']?.trim() || ''
  const graduationStatus = mapGraduationStatus(schoolLevelRaw)

  const gradeRaw = row['Grade/Year']?.trim() || ''
  const gradeLevel = mapGradeLevel(gradeRaw)

  const schoolName = formatSchoolName(
    row['Name of School/College/University']?.trim() || null
  )
  const email = row['Email Address:']?.trim()?.toLowerCase() || null
  const phone = formatPhoneNumber(row['Phone Number: WhatsApp']?.trim() || null)

  return {
    fullName,
    dateOfBirth,
    graduationStatus,
    gradeLevel,
    schoolName,
    email,
    phone,
  }
}

/**
 * Create a single student record with all related entities in a transaction
 * This prevents N+1 queries and ensures data consistency
 */
async function createStudentRecord(student: ProcessedStudent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Step 1: Create Person
    const person = await tx.person.create({
      data: {
        name: student.fullName,
        dateOfBirth: student.dateOfBirth,
      },
    })

    // Step 2: Create ContactPoints (email and/or phone) in parallel
    const contactPointPromises: Promise<unknown>[] = []

    if (student.email) {
      contactPointPromises.push(
        tx.contactPoint.create({
          data: {
            personId: person.id,
            type: 'EMAIL',
            value: student.email,
            isPrimary: true,
          },
        })
      )
    }

    if (student.phone) {
      contactPointPromises.push(
        tx.contactPoint.create({
          data: {
            personId: person.id,
            type: 'PHONE',
            value: student.phone,
            isPrimary: !student.email, // Primary if no email
          },
        })
      )
    }

    await Promise.all(contactPointPromises)

    // Step 3: Create ProgramProfile for Mahad program
    const programProfile = await tx.programProfile.create({
      data: {
        personId: person.id,
        program: Program.MAHAD_PROGRAM,
        // Mahad billing fields - defaults to NON_GRADUATE if provided
        graduationStatus: student.graduationStatus,
        gradeLevel: student.gradeLevel,
        schoolName: student.schoolName,
        // Leave billingType and paymentFrequency null for admin to set
      },
    })

    // Step 4: Create Enrollment (registered status, no batch yet)
    await tx.enrollment.create({
      data: {
        programProfileId: programProfile.id,
        status: 'REGISTERED',
        startDate: new Date(),
      },
    })
  })
}

async function seedData() {
  let totalRecords = 0
  let createdCount = 0
  const errorRecords: { row: ProcessedStudent; error: string }[] = []

  try {
    // Adjust the path if needed (assumes the CSV is at the project root)
    const rows = await parseCSV('batch4.csv')
    console.log(`Found ${rows.length} rows in CSV.`)

    for (const row of rows) {
      totalRecords++
      const student = processCSVRow(row)

      try {
        // Create all records in a single transaction (prevents N+1)
        await createStudentRecord(student)

        createdCount++
        console.log(
          `✅ Created records for ${student.fullName} (Person → Profile → Enrollment)`
        )
      } catch (createError: unknown) {
        const errorMessage =
          createError instanceof Error
            ? createError.message
            : String(createError)
        console.error(
          `❌ Error creating record for ${student.fullName}:`,
          errorMessage
        )
        errorRecords.push({
          row: student,
          error: errorMessage,
        })
      }
    }

    // Summary of the seeding process
    console.log('========== SEEDING SUMMARY ==========')
    console.log(`Total CSV rows processed: ${totalRecords}`)
    console.log(`Successfully created records: ${createdCount}`)
    console.log(`Records that failed: ${errorRecords.length}`)
    if (errorRecords.length > 0) {
      console.log('Details of records with errors:')
      errorRecords.forEach((err, index) => {
        console.log(
          `${index + 1}. ${err.row.fullName} (${err.row.email || 'No email'}): ${err.error}`
        )
      })
    }
    console.log('========== END OF SUMMARY ==========')
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Fatal error during seeding:', errorMessage)
  } finally {
    await prisma.$disconnect()
  }
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
