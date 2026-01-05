/**
 * Migration Script: TeacherAssignment -> DugsiClassTeacher
 *
 * This script migrates existing TeacherAssignment records to the new
 * class-based DugsiClassTeacher model.
 *
 * Logic:
 * 1. Find all active TeacherAssignments for Dugsi students
 * 2. For each assignment, look up the student's class enrollment
 * 3. Create DugsiClassTeacher entries linking teachers to classes
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-teacher-assignments-to-class.ts
 *   npx tsx scripts/migrate-teacher-assignments-to-class.ts
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error occurred
 */

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'

const DRY_RUN = process.env.DRY_RUN === 'true'

interface MigrationSummary {
  teacherAssignmentsFound: number
  studentsWithClassEnrollment: number
  studentsWithoutClassEnrollment: number
  classTeachersCreated: number
  classTeachersSkipped: number
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('TEACHER ASSIGNMENT TO CLASS MIGRATION')
  console.log('='.repeat(60))

  if (DRY_RUN) {
    console.log('MODE: DRY RUN (no changes will be made)\n')
  } else {
    console.log('MODE: LIVE (changes will be applied)\n')
  }

  const summary: MigrationSummary = {
    teacherAssignmentsFound: 0,
    studentsWithClassEnrollment: 0,
    studentsWithoutClassEnrollment: 0,
    classTeachersCreated: 0,
    classTeachersSkipped: 0,
  }

  // Find all active TeacherAssignments for Dugsi students
  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: {
      isActive: true,
      programProfile: {
        program: DUGSI_PROGRAM,
      },
    },
    include: {
      teacher: {
        include: {
          person: {
            select: { name: true },
          },
        },
      },
      programProfile: {
        include: {
          person: {
            select: { name: true },
          },
          dugsiClassEnrollment: {
            include: {
              class: {
                select: { id: true, name: true, shift: true },
              },
            },
          },
        },
      },
    },
  })

  summary.teacherAssignmentsFound = teacherAssignments.length
  console.log(
    `Found ${teacherAssignments.length} active TeacherAssignments for Dugsi\n`
  )

  // Group by teacher-class pairs to deduplicate
  const teacherClassPairs = new Map<
    string,
    {
      teacherId: string
      classId: string
      teacherName: string
      className: string
    }
  >()

  for (const assignment of teacherAssignments) {
    const enrollment = assignment.programProfile.dugsiClassEnrollment
    if (!enrollment) {
      summary.studentsWithoutClassEnrollment++
      console.log(
        `  SKIP: ${assignment.programProfile.person.name} - not enrolled in any class`
      )
      continue
    }

    summary.studentsWithClassEnrollment++

    const key = `${assignment.teacherId}-${enrollment.classId}`
    if (!teacherClassPairs.has(key)) {
      teacherClassPairs.set(key, {
        teacherId: assignment.teacherId,
        classId: enrollment.classId,
        teacherName: assignment.teacher.person.name,
        className: enrollment.class.name,
      })
    }
  }

  console.log(
    `\nUnique teacher-class pairs to migrate: ${teacherClassPairs.size}\n`
  )

  // Check existing DugsiClassTeacher entries to avoid duplicates
  const pairs = Array.from(teacherClassPairs.values())
  for (const pair of pairs) {
    const existing = await prisma.dugsiClassTeacher.findUnique({
      where: {
        classId_teacherId: {
          classId: pair.classId,
          teacherId: pair.teacherId,
        },
      },
    })

    if (existing) {
      summary.classTeachersSkipped++
      console.log(`  EXISTS: ${pair.teacherName} -> ${pair.className}`)
      continue
    }

    if (DRY_RUN) {
      summary.classTeachersCreated++
      console.log(`  WOULD CREATE: ${pair.teacherName} -> ${pair.className}`)
    } else {
      await prisma.dugsiClassTeacher.create({
        data: {
          classId: pair.classId,
          teacherId: pair.teacherId,
          isActive: true,
        },
      })
      summary.classTeachersCreated++
      console.log(`  CREATED: ${pair.teacherName} -> ${pair.className}`)
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(60))
  console.log(
    `TeacherAssignments found:         ${summary.teacherAssignmentsFound}`
  )
  console.log(
    `Students with class enrollment:   ${summary.studentsWithClassEnrollment}`
  )
  console.log(
    `Students without class enrollment: ${summary.studentsWithoutClassEnrollment}`
  )
  console.log(
    `DugsiClassTeacher records created: ${summary.classTeachersCreated}`
  )
  console.log(
    `DugsiClassTeacher records skipped: ${summary.classTeachersSkipped}`
  )

  if (DRY_RUN) {
    console.log('\nDRY RUN COMPLETE - No changes were made')
    console.log('Run without DRY_RUN=true to apply changes')
  } else {
    console.log('\nMIGRATION COMPLETE')
  }

  console.log('='.repeat(60) + '\n')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
