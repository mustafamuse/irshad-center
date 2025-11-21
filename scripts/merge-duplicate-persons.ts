#!/usr/bin/env tsx

/**
 * Merge Duplicate Person Records
 *
 * This script identifies and merges duplicate Person records that share
 * the same email or phone number across multiple Person records.
 *
 * This MUST be run BEFORE adding the unique constraint on ContactPoint.[type, value]
 * to ensure data integrity.
 *
 * Use Case:
 * - Teacher registered separately from parent role
 * - Same person registered in multiple programs before unification
 * - Data migration from legacy system created duplicates
 *
 * The script will:
 * 1. Find all duplicate email/phone across different Person records
 * 2. Select one Person to keep (prefer older/more complete record)
 * 3. Merge all relationships and data into kept Person:
 *    - Teacher role
 *    - ProgramProfiles
 *    - GuardianRelationships (as guardian and as dependent)
 *    - SiblingRelationships
 *    - BillingAccounts
 *    - ContactPoints
 * 4. Delete duplicate Person records
 *
 * Safety:
 * - Runs in dry-run mode by default (use --execute to actually merge)
 * - Creates backup before execution
 * - Wrapped in transactions for atomicity
 * - Logs all actions for audit trail
 *
 * Usage:
 *   npm run merge:duplicates -- --execute  # Actually perform merges
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface DuplicateContact {
  type: string
  value: string
  personIds: string[]
  personCount: number
}

interface MergeStats {
  totalDuplicates: number
  personsToDelete: number
  recordsMigrated: {
    teachers: number
    programProfiles: number
    guardianRelationships: number
    siblingRelationships: number
    billingAccounts: number
    contactPoints: number
  }
}

/**
 * Find all duplicate contacts (same email/phone on multiple Person records)
 */
async function findDuplicateContacts(): Promise<DuplicateContact[]> {
  console.log('\n🔍 Searching for duplicate contacts...\n')

  const duplicates = await prisma.$queryRaw<DuplicateContact[]>`
    SELECT
      type,
      value,
      array_agg(DISTINCT "personId" ORDER BY "personId") as "personIds",
      COUNT(DISTINCT "personId") as "personCount"
    FROM "ContactPoint"
    GROUP BY type, value
    HAVING COUNT(DISTINCT "personId") > 1
    ORDER BY "personCount" DESC, type, value
  `

  return duplicates
}

/**
 * Select which Person to keep from duplicates
 * Prefers: older record, more complete data, existing Teacher role
 */
async function selectPersonToKeep(personIds: string[]): Promise<string> {
  const persons = await prisma.person.findMany({
    where: { id: { in: personIds } },
    include: {
      contactPoints: true,
      programProfiles: true,
      guardianRelationships: true,
      dependentRelationships: true,
      billingAccounts: true,
      teacher: true,
    },
    orderBy: { createdAt: 'asc' }, // Prefer older record
  })

  // Score each person to determine best candidate
  const scored = persons.map((person) => ({
    id: person.id,
    score:
      (person.teacher ? 1000 : 0) + // Prefer teacher records
      person.programProfiles.length * 100 + // More profiles = more data
      person.billingAccounts.length * 50 + // Has billing setup
      person.guardianRelationships.length * 10 + // Is a guardian
      person.dependentRelationships.length * 10 + // Is a dependent
      person.contactPoints.length * 5, // More contact methods
    person,
  }))

  // Sort by score descending, then by createdAt ascending (older is better)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.person.createdAt.getTime() - b.person.createdAt.getTime()
  })

  const chosen = scored[0]
  console.log(
    `  ✓ Chose Person ${chosen.id} (score: ${chosen.score}, created: ${chosen.person.createdAt.toISOString()})`
  )

  return chosen.id
}

/**
 * Merge duplicate Person records
 */
async function mergeDuplicatePersons(
  keepPersonId: string,
  mergePersonIds: string[],
  dryRun: boolean = true
): Promise<MergeStats> {
  const stats: MergeStats = {
    totalDuplicates: mergePersonIds.length,
    personsToDelete: mergePersonIds.length,
    recordsMigrated: {
      teachers: 0,
      programProfiles: 0,
      guardianRelationships: 0,
      siblingRelationships: 0,
      billingAccounts: 0,
      contactPoints: 0,
    },
  }

  console.log(
    `\n${dryRun ? '📋 DRY RUN:' : '🔄 EXECUTING:'} Merging ${mergePersonIds.length} Person records into ${keepPersonId}\n`
  )

  if (dryRun) {
    // Count what would be migrated
    const counts = await Promise.all([
      prisma.teacher.count({ where: { personId: { in: mergePersonIds } } }),
      prisma.programProfile.count({
        where: { personId: { in: mergePersonIds } },
      }),
      prisma.guardianRelationship.count({
        where: {
          OR: [
            { guardianId: { in: mergePersonIds } },
            { dependentId: { in: mergePersonIds } },
          ],
        },
      }),
      prisma.siblingRelationship.count({
        where: {
          OR: [
            { person1Id: { in: mergePersonIds } },
            { person2Id: { in: mergePersonIds } },
          ],
        },
      }),
      prisma.billingAccount.count({
        where: { personId: { in: mergePersonIds } },
      }),
      prisma.contactPoint.count({
        where: { personId: { in: mergePersonIds } },
      }),
    ])

    stats.recordsMigrated = {
      teachers: counts[0],
      programProfiles: counts[1],
      guardianRelationships: counts[2],
      siblingRelationships: counts[3],
      billingAccounts: counts[4],
      contactPoints: counts[5],
    }

    console.log('  Would migrate:')
    console.log(`    - Teachers: ${stats.recordsMigrated.teachers}`)
    console.log(
      `    - ProgramProfiles: ${stats.recordsMigrated.programProfiles}`
    )
    console.log(
      `    - GuardianRelationships: ${stats.recordsMigrated.guardianRelationships}`
    )
    console.log(
      `    - SiblingRelationships: ${stats.recordsMigrated.siblingRelationships}`
    )
    console.log(
      `    - BillingAccounts: ${stats.recordsMigrated.billingAccounts}`
    )
    console.log(`    - ContactPoints: ${stats.recordsMigrated.contactPoints}`)
    console.log(`    - Persons to delete: ${stats.personsToDelete}`)

    return stats
  }

  // EXECUTE MERGE
  await prisma.$transaction(
    async (tx) => {
      console.log('  1️⃣  Migrating Teacher records...')
      const teacherResult = await tx.teacher.updateMany({
        where: { personId: { in: mergePersonIds } },
        data: { personId: keepPersonId },
      })
      stats.recordsMigrated.teachers = teacherResult.count
      console.log(`     ✓ Migrated ${teacherResult.count} teacher records`)

      console.log('  2️⃣  Migrating ProgramProfiles...')
      // Handle potential unique constraint violation (personId, program)
      const profiles = await tx.programProfile.findMany({
        where: { personId: { in: mergePersonIds } },
        select: { id: true, personId: true, program: true },
      })

      for (const profile of profiles) {
        // Check if kept Person already has profile for same program
        const existingProfile = await tx.programProfile.findFirst({
          where: {
            personId: keepPersonId,
            program: profile.program,
          },
        })

        if (existingProfile) {
          // Merge enrollments and assignments to existing profile, then delete duplicate
          await tx.enrollment.updateMany({
            where: { programProfileId: profile.id },
            data: { programProfileId: existingProfile.id },
          })

          await tx.billingAssignment.updateMany({
            where: { programProfileId: profile.id },
            data: { programProfileId: existingProfile.id },
          })

          await tx.teacherAssignment.updateMany({
            where: { programProfileId: profile.id },
            data: { programProfileId: existingProfile.id },
          })

          await tx.studentPayment.updateMany({
            where: { programProfileId: profile.id },
            data: { programProfileId: existingProfile.id },
          })

          // Delete duplicate profile
          await tx.programProfile.delete({ where: { id: profile.id } })
          console.log(
            `     ⚠️  Merged profile ${profile.id} into existing ${existingProfile.id} (${profile.program})`
          )
        } else {
          // Move profile to kept Person
          await tx.programProfile.update({
            where: { id: profile.id },
            data: { personId: keepPersonId },
          })
          stats.recordsMigrated.programProfiles++
        }
      }
      console.log(
        `     ✓ Migrated ${stats.recordsMigrated.programProfiles} program profiles`
      )

      console.log('  3️⃣  Migrating GuardianRelationships...')
      const guardianAsGuardianResult = await tx.guardianRelationship.updateMany(
        {
          where: { guardianId: { in: mergePersonIds } },
          data: { guardianId: keepPersonId },
        }
      )
      const guardianAsDependentResult =
        await tx.guardianRelationship.updateMany({
          where: { dependentId: { in: mergePersonIds } },
          data: { dependentId: keepPersonId },
        })
      stats.recordsMigrated.guardianRelationships =
        guardianAsGuardianResult.count + guardianAsDependentResult.count
      console.log(
        `     ✓ Migrated ${stats.recordsMigrated.guardianRelationships} guardian relationships`
      )

      console.log('  4️⃣  Migrating SiblingRelationships...')
      // Sibling relationships need special handling due to ordering constraint
      const siblingRelationships = await tx.siblingRelationship.findMany({
        where: {
          OR: [
            { person1Id: { in: mergePersonIds } },
            { person2Id: { in: mergePersonIds } },
          ],
        },
      })

      for (const rel of siblingRelationships) {
        // Determine new person1Id and person2Id
        const newPerson1Id =
          rel.person1Id === mergePersonIds.find((id) => id === rel.person1Id)
            ? keepPersonId
            : rel.person1Id
        const newPerson2Id =
          rel.person2Id === mergePersonIds.find((id) => id === rel.person2Id)
            ? keepPersonId
            : rel.person2Id

        // Skip if both siblings are in merge list (would create self-sibling)
        if (newPerson1Id === newPerson2Id) {
          console.log(`     ⚠️  Skipping self-sibling relationship ${rel.id}`)
          await tx.siblingRelationship.delete({ where: { id: rel.id } })
          continue
        }

        // Ensure proper ordering
        const [p1, p2] = [newPerson1Id, newPerson2Id].sort()

        // Check if this relationship already exists with kept Person
        const existingRel = await tx.siblingRelationship.findFirst({
          where: { person1Id: p1, person2Id: p2 },
        })

        if (existingRel && existingRel.id !== rel.id) {
          // Duplicate relationship exists, delete current one
          await tx.siblingRelationship.delete({ where: { id: rel.id } })
          console.log(
            `     ⚠️  Removed duplicate sibling relationship ${rel.id}`
          )
        } else {
          // Update relationship with correct person IDs and ordering
          await tx.siblingRelationship.update({
            where: { id: rel.id },
            data: { person1Id: p1, person2Id: p2 },
          })
          stats.recordsMigrated.siblingRelationships++
        }
      }
      console.log(
        `     ✓ Migrated ${stats.recordsMigrated.siblingRelationships} sibling relationships`
      )

      console.log('  5️⃣  Migrating BillingAccounts...')
      const billingResult = await tx.billingAccount.updateMany({
        where: { personId: { in: mergePersonIds } },
        data: { personId: keepPersonId },
      })
      stats.recordsMigrated.billingAccounts = billingResult.count
      console.log(`     ✓ Migrated ${billingResult.count} billing accounts`)

      console.log('  6️⃣  Migrating ContactPoints...')
      const contactsToMigrate = await tx.contactPoint.findMany({
        where: { personId: { in: mergePersonIds } },
      })

      for (const contact of contactsToMigrate) {
        // Check if kept Person already has this contact
        const existingContact = await tx.contactPoint.findFirst({
          where: {
            personId: keepPersonId,
            type: contact.type,
            value: contact.value,
          },
        })

        if (existingContact) {
          // Keep the better verified/primary status
          if (
            contact.verificationStatus === 'VERIFIED' &&
            existingContact.verificationStatus !== 'VERIFIED'
          ) {
            await tx.contactPoint.update({
              where: { id: existingContact.id },
              data: {
                verificationStatus: contact.verificationStatus,
                verifiedAt: contact.verifiedAt,
              },
            })
          }

          if (contact.isPrimary && !existingContact.isPrimary) {
            await tx.contactPoint.update({
              where: { id: existingContact.id },
              data: { isPrimary: true },
            })
          }

          // Delete duplicate contact
          await tx.contactPoint.delete({ where: { id: contact.id } })
        } else {
          // Move contact to kept Person
          await tx.contactPoint.update({
            where: { id: contact.id },
            data: { personId: keepPersonId },
          })
          stats.recordsMigrated.contactPoints++
        }
      }
      console.log(
        `     ✓ Migrated ${stats.recordsMigrated.contactPoints} unique contact points`
      )

      console.log('  7️⃣  Deleting duplicate Person records...')
      const deleteResult = await tx.person.deleteMany({
        where: { id: { in: mergePersonIds } },
      })
      console.log(`     ✓ Deleted ${deleteResult.count} duplicate persons`)

      console.log(
        `\n✅ Successfully merged ${mergePersonIds.length} duplicate Person records into ${keepPersonId}\n`
      )
    },
    {
      timeout: 60000, // 60 second timeout for large merges
    }
  )

  return stats
}

/**
 * Create backup of current database state
 */
async function createBackup(): Promise<string> {
  console.log('\n💾 Creating database backup...\n')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(
    process.cwd(),
    'backups',
    `pre-merge-backup-${timestamp}.json`
  )

  // Ensure backups directory exists
  const backupsDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  // Export all relevant data
  const data = {
    persons: await prisma.person.findMany({
      include: {
        contactPoints: true,
        programProfiles: true,
        teacher: true,
      },
    }),
    siblingRelationships: await prisma.siblingRelationship.findMany(),
    guardianRelationships: await prisma.guardianRelationship.findMany(),
    billingAccounts: await prisma.billingAccount.findMany(),
  }

  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2))

  console.log(`  ✓ Backup created at: ${backupPath}\n`)
  return backupPath
}

/**
 * Main execution
 */
async function main() {
  const dryRun = !process.argv.includes('--execute')

  console.log('='.repeat(80))
  console.log('🔀 MERGE DUPLICATE PERSON RECORDS')
  console.log('='.repeat(80))
  console.log(
    `Mode: ${dryRun ? '📋 DRY RUN (no changes)' : '⚡ EXECUTE (will modify database)'}`
  )
  console.log('='.repeat(80))

  try {
    // Find duplicates
    const duplicates = await findDuplicateContacts()

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicate contacts found! Database is clean.\n')
      return
    }

    console.log(
      `\n⚠️  Found ${duplicates.length} duplicate contact(s) across multiple Person records:\n`
    )

    // Display duplicates
    duplicates.forEach((dup, index) => {
      console.log(
        `  ${index + 1}. ${dup.type}: "${dup.value}" → ${dup.personCount} Person records`
      )
      console.log(`     Person IDs: ${dup.personIds.join(', ')}`)
    })

    // Create backup if executing
    let backupPath: string | null = null
    if (!dryRun) {
      backupPath = await createBackup()
    }

    // Process each duplicate
    let totalStats: MergeStats = {
      totalDuplicates: 0,
      personsToDelete: 0,
      recordsMigrated: {
        teachers: 0,
        programProfiles: 0,
        guardianRelationships: 0,
        siblingRelationships: 0,
        billingAccounts: 0,
        contactPoints: 0,
      },
    }

    for (let i = 0; i < duplicates.length; i++) {
      const dup = duplicates[i]
      console.log(
        `\n${'─'.repeat(80)}\n📋 Processing duplicate ${i + 1}/${duplicates.length}: ${dup.type} "${dup.value}"\n${'─'.repeat(80)}`
      )

      // Select person to keep
      const keepPersonId = await selectPersonToKeep(dup.personIds)
      const mergePersonIds = dup.personIds.filter((id) => id !== keepPersonId)

      // Merge
      const stats = await mergeDuplicatePersons(
        keepPersonId,
        mergePersonIds,
        dryRun
      )

      // Aggregate stats
      totalStats.totalDuplicates += stats.totalDuplicates
      totalStats.personsToDelete += stats.personsToDelete
      Object.keys(stats.recordsMigrated).forEach((key) => {
        totalStats.recordsMigrated[key as keyof typeof stats.recordsMigrated] +=
          stats.recordsMigrated[key as keyof typeof stats.recordsMigrated]
      })
    }

    // Final summary
    console.log('\n' + '='.repeat(80))
    console.log('📊 MERGE SUMMARY')
    console.log('='.repeat(80))
    console.log(`\nTotal duplicate groups processed: ${duplicates.length}`)
    console.log(
      `Total Person records ${dryRun ? 'would be' : 'were'} deleted: ${totalStats.personsToDelete}`
    )
    console.log(`\nRecords ${dryRun ? 'would be' : 'were'} migrated:`)
    console.log(`  - Teachers: ${totalStats.recordsMigrated.teachers}`)
    console.log(
      `  - ProgramProfiles: ${totalStats.recordsMigrated.programProfiles}`
    )
    console.log(
      `  - GuardianRelationships: ${totalStats.recordsMigrated.guardianRelationships}`
    )
    console.log(
      `  - SiblingRelationships: ${totalStats.recordsMigrated.siblingRelationships}`
    )
    console.log(
      `  - BillingAccounts: ${totalStats.recordsMigrated.billingAccounts}`
    )
    console.log(
      `  - ContactPoints: ${totalStats.recordsMigrated.contactPoints}`
    )

    if (backupPath) {
      console.log(`\n💾 Backup saved at: ${backupPath}`)
    }

    if (dryRun) {
      console.log('\n📋 DRY RUN COMPLETE - No changes were made')
      console.log(
        '   To execute the merge, run: npm run merge:duplicates -- --execute'
      )
    } else {
      console.log('\n✅ MERGE COMPLETE - All duplicates have been resolved')
      console.log(
        '   You can now safely add the unique constraint on ContactPoint'
      )
    }
    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ Error during merge:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
