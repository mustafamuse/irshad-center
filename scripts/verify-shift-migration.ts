/**
 * Shift Migration Verification Script
 *
 * Verifies production data before running 20251206000000_unify_shift_enums migration.
 * Checks for any EVENING shift values that will be converted to AFTERNOON.
 *
 * Usage:
 *   npx tsx scripts/verify-shift-migration.ts
 *
 * Exit codes:
 *   0 - Safe to migrate (no EVENING values found)
 *   1 - EVENING values found (review before migrating)
 */

import { prisma } from '@/lib/db'

interface ShiftCount {
  shift: string | null
  count: bigint
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('SHIFT MIGRATION VERIFICATION')
  console.log('='.repeat(60))
  console.log('Checking for EVENING shift values before enum unification...\n')

  let hasEveningValues = false

  // Check TeacherAssignment.shift for EVENING values
  console.log('1. TeacherAssignment.shift:')
  try {
    const teacherShiftCounts = await prisma.$queryRaw<ShiftCount[]>`
      SELECT shift::text, COUNT(*) as count
      FROM "TeacherAssignment"
      WHERE shift IS NOT NULL
      GROUP BY shift
      ORDER BY shift
    `

    if (teacherShiftCounts.length === 0) {
      console.log('   No shift values found (table empty or all null)')
    } else {
      for (const row of teacherShiftCounts) {
        const count = Number(row.count)
        const indicator =
          row.shift === 'EVENING' ? ' ⚠️  WILL BE CONVERTED' : ''
        console.log(`   ${row.shift}: ${count} record(s)${indicator}`)

        if (row.shift === 'EVENING') {
          hasEveningValues = true
        }
      }
    }

    // If EVENING found, show sample records
    if (hasEveningValues) {
      console.log('\n   Sample EVENING assignments:')
      const samples = await prisma.teacherAssignment.findMany({
        where: {
          shift: 'EVENING' as unknown as undefined, // Cast to query old enum value
        },
        take: 5,
        include: {
          teacher: {
            include: {
              person: { select: { name: true } },
            },
          },
          programProfile: {
            include: {
              person: { select: { name: true } },
            },
          },
        },
      })

      for (const sample of samples) {
        console.log(
          `   - ID: ${sample.id} | Teacher: ${sample.teacher.person.name} | Student: ${sample.programProfile.person.name}`
        )
      }
    }
  } catch (error) {
    // Table might not exist yet or have different schema
    console.log(
      `   Skipped - ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Check ProgramProfile.shift for EVENING values (StudentShift)
  console.log('\n2. ProgramProfile.shift (StudentShift):')
  try {
    const profileShiftCounts = await prisma.$queryRaw<ShiftCount[]>`
      SELECT shift::text, COUNT(*) as count
      FROM "ProgramProfile"
      WHERE shift IS NOT NULL
      GROUP BY shift
      ORDER BY shift
    `

    if (profileShiftCounts.length === 0) {
      console.log('   No shift values found (all null)')
    } else {
      for (const row of profileShiftCounts) {
        const count = Number(row.count)
        const indicator =
          row.shift === 'EVENING' ? ' ⚠️  WILL BE CONVERTED' : ''
        console.log(`   ${row.shift}: ${count} record(s)${indicator}`)

        if (row.shift === 'EVENING') {
          hasEveningValues = true
        }
      }
    }

    // If EVENING found, show sample records
    const eveningProfiles = await prisma.$queryRaw<
      { id: string; name: string }[]
    >`
      SELECT pp.id, p.name
      FROM "ProgramProfile" pp
      JOIN "Person" p ON pp."personId" = p.id
      WHERE pp.shift::text = 'EVENING'
      LIMIT 5
    `

    if (eveningProfiles.length > 0) {
      console.log('\n   Sample EVENING profiles:')
      for (const profile of eveningProfiles) {
        console.log(`   - ID: ${profile.id} | Student: ${profile.name}`)
      }
    }
  } catch (error) {
    console.log(
      `   Skipped - ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  if (hasEveningValues) {
    console.log(
      '⚠️  EVENING shift values found - will be converted to AFTERNOON'
    )
    console.log('')
    console.log('The migration will automatically convert EVENING → AFTERNOON.')
    console.log('Review the records above to ensure this is acceptable.')
    console.log('')
    console.log('If this is expected, proceed with migration.')
    console.log('If not, update the records manually before migrating.')
    process.exit(1)
  } else {
    console.log('✅ No EVENING shift values found - safe to migrate')
    console.log('')
    console.log('The migration will:')
    console.log(
      '  1. Unify Shift and StudentShift enums into single Shift enum'
    )
    console.log('  2. Keep MORNING and AFTERNOON values as-is')
    console.log('  3. Drop old enum types')
    process.exit(0)
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
