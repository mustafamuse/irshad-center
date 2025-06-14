import { EducationLevel, GradeLevel, DayOfWeek } from '@prisma/client'
import csvParser from 'csv-parser'
import * as fs from 'fs'

import { prisma } from '@/lib/db'
import { generateClassSessionsForSchedule } from '@/lib/scheduling'

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
  console.log('❌ Dropping attendance-related table data...')

  // Drop tables in order based on foreign key relationships
  await prisma.$transaction([
    prisma.attendance.deleteMany(),
    prisma.classSession.deleteMany(),
    prisma.classSchedule.deleteMany(),
    // Keeping Student, Batch, Sibling, and StudentPayment data
    prisma.subject.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.teacher.deleteMany(),
  ])

  console.log('✅ Attendance-related table data has been cleared.')
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

async function seedTeachers() {
  console.log('🌱 Seeding teachers...')
  const teachers = [
    { name: 'Mr. Smith', email: 'mr.smith@example.com', phone: '111-222-3333' },
    { name: 'Ms. Jones', email: 'ms.jones@example.com', phone: '444-555-6666' },
  ]
  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { email: teacher.email },
      update: teacher,
      create: teacher,
    })
  }
  console.log('✅ Teachers seeded.')
}

async function seedSubjects() {
  console.log('🌱 Seeding subjects...')
  const subjects = [
    { name: 'Algebra II', description: 'Advanced algebra topics.' },
    { name: 'History 101', description: 'Introduction to world history.' },
    { name: 'Biology', description: 'The study of living organisms.' },
  ]
  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { name: subject.name },
      update: { description: subject.description },
      create: subject,
    })
  }
  console.log('✅ Subjects seeded.')
}

async function seedBatches() {
  console.log('🌱 Seeding batches...')
  const batches = [{ name: 'Grade 10 Batch' }, { name: 'Grade 11 Batch' }]
  for (const batch of batches) {
    await prisma.batch.upsert({
      where: { name: batch.name },
      update: {},
      create: { name: batch.name },
    })
  }
  console.log('✅ Batches seeded.')
}

async function seedSemesters() {
  console.log('🌱 Seeding semesters...')
  const startDate = new Date('2025-04-01')
  const endDate = new Date('2025-12-20')
  const semesterData = {
    name: 'Fall 2025',
    startDate,
    endDate,
  }

  await prisma.semester.upsert({
    where: { name: semesterData.name },
    update: semesterData,
    create: semesterData,
  })
  console.log('✅ Semesters seeded.')
}

async function seedClassSchedules() {
  console.log('🌱 Seeding class schedules...')
  const teacher = await prisma.teacher.findFirst({
    where: { email: 'mr.smith@example.com' },
  })
  const subject = await prisma.subject.findFirst({
    where: { name: 'Algebra II' },
  })
  const batch = await prisma.batch.findFirst({
    where: { name: 'Grade 10 Batch' },
  })
  const semester = await prisma.semester.findUnique({
    where: { name: 'Fall 2025' },
  })

  if (teacher && subject && batch && semester) {
    const scheduleData = {
      teacherId: teacher.id,
      subjectId: subject.id,
      batchId: batch.id,
      semesterId: semester.id,
      daysOfWeek: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
      startTime: '10:00',
      endTime: '11:30',
    }
    const newSchedule = await prisma.classSchedule.upsert({
      where: {
        batchId_subjectId: {
          batchId: batch.id,
          subjectId: subject.id,
        },
      },
      update: scheduleData,
      create: scheduleData,
    })
    console.log('✅ Class schedules seeded.')
    return newSchedule
  } else {
    console.log(
      'Could not seed class schedules due to missing data (teacher, subject, batch, or semester).'
    )
    return null
  }
}

// The 'seedData' function is intentionally unused for now to avoid dependency on a missing CSV file.
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
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
        // Create or update the student record in the database.
        const studentData = {
          name: fullName,
          phone: phone,
          dateOfBirth: dateOfBirth,
          educationLevel: educationLevel,
          gradeLevel: gradeLevel,
          schoolName: schoolName,
          highSchoolGraduated: highSchoolGraduated,
          collegeGraduated: collegeGraduated,
          postGradCompleted: postGradCompleted,
        }

        if (email) {
          await prisma.student.upsert({
            where: { email: email },
            update: studentData,
            create: { ...studentData, email: email },
          })
        } else {
          // If no email, create a new record. Be aware of potential duplicates.
          await prisma.student.create({ data: studentData })
        }

        createdCount++
        console.log(`Upserted student record for ${fullName}`)
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
  await seedTeachers()
  await seedSubjects()
  await seedBatches()
  await seedSemesters()
  const schedule = await seedClassSchedules()
  // await seedData() // This is the original student seeding function - disabled for now

  if (schedule) {
    console.log(`\n🔥 Generating sessions for schedule: ${schedule.id}`)
    await generateClassSessionsForSchedule(schedule.id)
  }
}

// Run the seeding script as CLI
main()
  .then(async () => {
    // Only disconnect here because we're done with the CLI run
    await prisma.$disconnect()
  })
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
