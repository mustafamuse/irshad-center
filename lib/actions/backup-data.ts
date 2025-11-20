'use server'

// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

import fs from 'fs'
import path from 'path'

import { prisma } from '@/lib/db'

// Add validation types
interface BackupValidation {
  students: {
    total: number
    withBatch: number
    withSubscription: number
    withSiblings: number
  }
  relationships: {
    validSiblingGroups: boolean
    validBatchLinks: boolean
  }
}

export async function backupData(): Promise<
  | {
      success: true
      fileName: string
      validation: BackupValidation
      stats: { students: number; batches: number; siblings: number; studentPayments: number }
    }
  | { success: false; error: string }
> {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    success: false,
    error: 'Migration needed: Student model has been removed. Please migrate to ProgramProfile/Enrollment model before backing up data.',
  }

  /* Original implementation commented out - needs migration:
  try {
    // First validate the data
    console.log('🔍 Starting data validation...')

    // Get all data with complete relationships
    const students = await prisma.student.findMany({
      include: {
        Batch: true,
        Sibling: {
          include: {
            Student: {
              select: {
                id: true,
                name: true,
                status: true,
                siblingGroupId: true,
              },
            },
          },
        },
        StudentPayment: true,
      },
    })

    const batches = await prisma.batch.findMany()
    const siblings = await prisma.sibling.findMany({
      include: {
        Student: true,
      },
    })
    const studentPayments = await prisma.studentPayment.findMany()

    // Validate relationships
    const validation: BackupValidation = {
      students: {
        total: students.length,
        withBatch: students.filter((s) => s.Batch).length,
        withSubscription: students.filter((s) => s.stripeSubscriptionId).length,
        withSiblings: students.filter((s) => s.Sibling).length,
      },
      relationships: {
        validSiblingGroups: students.every(
          (s) =>
            !s.siblingGroupId ||
            s.Sibling?.Student.some(
              (sibling) =>
                sibling.id !== s.id &&
                sibling.siblingGroupId === s.siblingGroupId
            )
        ),
        validBatchLinks: students.every((s) => !s.batchId || s.Batch !== null),
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
        version: '2.0',
        validation,
        totalCounts: {
          students: students.length,
          batches: batches.length,
          siblings: siblings.length,
          studentPayments: studentPayments.length,
        },
      },
      data: {
        students: students.map((student) => ({
          ...student,
          StudentPayment: undefined, // Remove the included payments to avoid duplicates
        })),
        batches,
        siblings,
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
  */
}
