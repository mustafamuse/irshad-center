import { EducationLevel, GradeLevel } from '@prisma/client'
import csvParser from 'csv-parser'
import * as fs from 'fs'

import { prisma } from '@/lib/db'

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
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
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

  // ⚠️ CRITICAL MIGRATION NEEDED: Student and Sibling models have been removed
  // TODO: Migrate to ProgramProfile/Enrollment model

  // Drop tables in order based on foreign key relationships
  await prisma.$transaction([
    // prisma.$executeRaw`DELETE FROM "_ClassGroupToStudent"`, // many-to-many
    prisma.studentPayment.deleteMany(),
    // prisma.student.deleteMany(), // TODO: Student model removed
    // prisma.sibling.deleteMany(), // TODO: Sibling model removed
    prisma.batch.deleteMany(),
  ])

  console.log('✅ All table data has been cleared.')
}

/**
 * Calculate age based on a given birth date.
 */
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
 * Map the CSV "Current School level" value to the EducationLevel enum.
 * Returns:
 *  - EducationLevel.COLLEGE if the value is "College"
 *  - EducationLevel.HIGH_SCHOOL if the value is "Highschool" or "High school"
 *  - Otherwise (for example, "Currently not in school"), returns null so we can guess using age.
 */
function mapEducationLevel(level: string): EducationLevel | null {
  if (!level) return null
  const lvl = level.trim().toLowerCase()
  if (lvl === 'college') {
    return EducationLevel.COLLEGE
  } else if (lvl === 'highschool' || lvl === 'high school') {
    return EducationLevel.HIGH_SCHOOL
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
 * Parse a CSV file and return an array of row objects.
 */
function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = []
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err))
  })
}

async function seedData() {
  let totalRecords = 0
  let createdCount = 0
  const errorRecords: { row: any; error: string }[] = []

  try {
    // Adjust the path if needed (assumes the CSV is at the project root)
    const rows = await parseCSV('batch4.csv')
    console.log(`Found ${rows.length} rows in CSV.`)

    for (const row of rows) {
      totalRecords++
      // Format names properly
      const firstName = capitalizeWords(row['First Name:']?.trim() || '')
      const lastName = capitalizeWords(row['Last Name:']?.trim() || '')
      const fullName = `${firstName} ${lastName}`

      const dobValue = row['Date of Birth']?.trim()
      const dateOfBirth = dobValue ? new Date(dobValue) : null

      const schoolLevelRaw = row['Current School level']?.trim() || ''
      const educationLevel = mapEducationLevel(schoolLevelRaw)

      const gradeRaw = row['Grade/Year']?.trim() || ''
      const gradeLevel = mapGradeLevel(gradeRaw)

      // Format school name
      const schoolName = formatSchoolName(
        row['Name of School/College/University']?.trim() || null
      )
      const email = row['Email Address:']?.trim()?.toLowerCase() || null
      // Format phone number
      const phone = formatPhoneNumber(
        row['Phone Number: WhatsApp']?.trim() || null
      )

      // Initialize graduation booleans to their defaults.
      let highSchoolGraduated = false
      let collegeGraduated = false
      let postGradCompleted = false

      // If the Grade/Year indicates graduation...
      if (
        gradeRaw.toLowerCase() === 'graduated' ||
        gradeRaw.toLowerCase() === 'graduate'
      ) {
        // Use the mapped education level if available.
        if (educationLevel === EducationLevel.COLLEGE) {
          collegeGraduated = true
        } else if (educationLevel === EducationLevel.HIGH_SCHOOL) {
          highSchoolGraduated = true
        } else {
          // If educationLevel is null (e.g. "Currently not in school"), guess based on age.
          if (
            schoolLevelRaw.toLowerCase() === 'currently not in school' &&
            dateOfBirth
          ) {
            const age = calculateAge(dateOfBirth)
            // Heuristic: if age is less than 21, assume high school graduation; if 21 or older, assume college graduation.
            if (age < 21) {
              highSchoolGraduated = true
            } else {
              collegeGraduated = true
            }
          }
        }
      }

      try {
        // ⚠️ CRITICAL MIGRATION NEEDED: Student model has been removed
        // TODO: Migrate to ProgramProfile/Enrollment model
        /* Original code commented out - needs migration:
        await prisma.student.create({
          data: {
            name: fullName,
            email: email,
            phone: phone,
            dateOfBirth: dateOfBirth,
            educationLevel: educationLevel,
            gradeLevel: gradeLevel,
            schoolName: schoolName,
            highSchoolGraduated: highSchoolGraduated,
            collegeGraduated: collegeGraduated,
            postGradCompleted: postGradCompleted,
          },
        })

        createdCount++
        console.log(`Created student record for ${fullName}`)
        */
        console.log(`Skipping student creation (model removed): ${fullName}`)
      } catch (createError: any) {
        console.error(
          `Error creating record for ${fullName}:`,
          createError.message
        )
        errorRecords.push({
          row: { fullName, email },
          error: createError.message,
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
  } catch (err: any) {
    console.error('Fatal error during seeding:', err)
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
