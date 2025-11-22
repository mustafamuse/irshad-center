'use server'

import * as fs from 'fs'
import * as path from 'path'

import { prisma } from '@/lib/db'

// Add validation types
interface BackupValidation {
  profiles: {
    total: number
    withBatch: number
    withBilling: number
    withSiblings: number
  }
  relationships: {
    validSiblingRelationships: boolean
    validBatchLinks: boolean
  }
}

export async function backupData(): Promise<
  | {
      success: true
      fileName: string
      validation: BackupValidation
      stats: {
        persons: number
        profiles: number
        enrollments: number
        batches: number
        siblingRelationships: number
        studentPayments: number
      }
    }
  | { success: false; error: string }
> {
  try {
    // First validate the data
    console.log('🔍 Starting data validation...')

    // Get all data with complete relationships
    const persons = await prisma.person.findMany({
      include: {
        contactPoints: true,
        programProfiles: {
          include: {
            enrollments: {
              include: {
                batch: true,
              },
            },
            assignments: {
              include: {
                subscription: true,
              },
            },
            payments: true,
          },
        },
        siblingRelationships1: {
          where: { isActive: true },
        },
        siblingRelationships2: {
          where: { isActive: true },
        },
      },
    })

    const batches = await prisma.batch.findMany({
      include: {
        Enrollment: {
          select: {
            id: true,
            status: true,
            programProfileId: true,
          },
        },
      },
    })

    const siblingRelationships = await prisma.siblingRelationship.findMany({
      where: { isActive: true },
      include: {
        person1: {
          select: {
            id: true,
            name: true,
          },
        },
        person2: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const studentPayments = await prisma.studentPayment.findMany({
      include: {
        ProgramProfile: {
          select: {
            id: true,
            person: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Count enrollments and profiles across all persons
    const allProfiles = persons.flatMap((p) => p.programProfiles)
    const allEnrollments = allProfiles.flatMap((p) => p.enrollments)

    // Validate relationships
    const validation: BackupValidation = {
      profiles: {
        total: allProfiles.length,
        withBatch: allEnrollments.filter((e) => e.batch).length,
        withBilling: allProfiles.filter((p) => p.assignments.length > 0).length,
        withSiblings: persons.filter(
          (p) =>
            p.siblingRelationships1.length > 0 ||
            p.siblingRelationships2.length > 0
        ).length,
      },
      relationships: {
        validSiblingRelationships: siblingRelationships.every(
          (rel) => rel.person1 && rel.person2
        ),
        validBatchLinks: allEnrollments.every(
          (e) => !e.batchId || e.batch !== null
        ),
      },
    }

    console.log('✅ Data validation complete:', validation)

    // Continue with backup if validation passes
    if (!Object.values(validation.relationships).every(Boolean)) {
      throw new Error('Data validation failed: Invalid relationships detected')
    }

    // Create backup object
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '3.0', // Updated version for new schema
        schema: 'ProgramProfile/Person/Enrollment',
        validation,
        totalCounts: {
          persons: persons.length,
          profiles: allProfiles.length,
          enrollments: allEnrollments.length,
          batches: batches.length,
          siblingRelationships: siblingRelationships.length,
          studentPayments: studentPayments.length,
        },
      },
      data: {
        persons,
        batches,
        siblingRelationships,
        studentPayments,
      },
    }

    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Save to JSON file with detailed timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup-${timestamp}.json`

    fs.writeFileSync(
      path.join(backupDir, fileName),
      JSON.stringify(backup, null, 2)
    )

    // Log backup stats
    console.log('✅ Backup completed:', {
      fileName,
      counts: backup.metadata.totalCounts,
      size: `${(JSON.stringify(backup).length / 1024 / 1024).toFixed(2)}MB`,
    })

    return {
      success: true,
      fileName,
      validation,
      stats: backup.metadata.totalCounts,
    }
  } catch (error) {
    console.error('❌ Backup failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
