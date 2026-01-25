'use server'

/**
 * Data Backup Action
 *
 * Exports Mahad student data for backup purposes.
 * Produces JSON format suitable for data restoration or migration.
 */

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { createActionLogger, logError } from '@/lib/logger'
import {
  extractStudentEmail,
  extractStudentPhone,
} from '@/lib/mappers/mahad-mapper'

const logger = createActionLogger('backup-data')

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface StudentBackupRecord {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  gradeLevel: string | null
  schoolName: string | null
  // Mahad billing fields
  graduationStatus: string | null
  paymentFrequency: string | null
  billingType: string | null
  paymentNotes: string | null
  status: string
  createdAt: string
  updatedAt: string
  enrollment: {
    id: string
    status: string
    startDate: string
    endDate: string | null
    batchId: string | null
    batchName: string | null
  } | null
  subscription: {
    id: string
    stripeSubscriptionId: string | null
    stripeCustomerId: string | null
    status: string
    amount: number
  } | null
  siblings: Array<{
    id: string
    name: string
  }>
}

interface BackupResult {
  success: boolean
  data?: {
    exportDate: string
    recordCount: number
    students: StudentBackupRecord[]
  }
  error?: string
}

// ============================================================================
// MAIN ACTION
// ============================================================================

/**
 * Export all Mahad student data for backup
 *
 * Returns a complete snapshot of student data including:
 * - Person information (name, contact, DOB)
 * - ProgramProfile details (education, rates)
 * - Enrollment status and batch
 * - Subscription information
 * - Sibling relationships
 */
export async function backupData(): Promise<BackupResult> {
  try {
    // Get all Mahad profiles with full relations
    const profiles = await prisma.programProfile.findMany({
      where: {
        program: MAHAD_PROGRAM,
      },
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
        enrollments: {
          where: {
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
          include: {
            batch: true,
          },
          orderBy: {
            startDate: 'desc',
          },
          take: 1,
        },
        assignments: {
          where: { isActive: true },
          include: {
            subscription: true,
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Get all sibling relationships
    const siblingRelationships = await prisma.siblingRelationship.findMany({
      where: {
        isActive: true,
        OR: [
          {
            person1: {
              programProfiles: {
                some: {
                  program: MAHAD_PROGRAM,
                },
              },
            },
          },
          {
            person2: {
              programProfiles: {
                some: {
                  program: MAHAD_PROGRAM,
                },
              },
            },
          },
        ],
      },
      include: {
        person1: {
          include: {
            programProfiles: {
              where: { program: MAHAD_PROGRAM },
              select: { id: true },
            },
          },
        },
        person2: {
          include: {
            programProfiles: {
              where: { program: MAHAD_PROGRAM },
              select: { id: true },
            },
          },
        },
      },
    })

    // Build sibling map: personId -> array of sibling info
    const siblingMap = new Map<string, Array<{ id: string; name: string }>>()

    for (const rel of siblingRelationships) {
      // Add person2 as sibling of person1
      const siblings1 = siblingMap.get(rel.person1Id) || []
      if (rel.person2.programProfiles.length > 0) {
        siblings1.push({
          id: rel.person2.programProfiles[0].id,
          name: rel.person2.name,
        })
      }
      siblingMap.set(rel.person1Id, siblings1)

      // Add person1 as sibling of person2
      const siblings2 = siblingMap.get(rel.person2Id) || []
      if (rel.person1.programProfiles.length > 0) {
        siblings2.push({
          id: rel.person1.programProfiles[0].id,
          name: rel.person1.name,
        })
      }
      siblingMap.set(rel.person2Id, siblings2)
    }

    // Map profiles to backup records
    const students: StudentBackupRecord[] = profiles.map((profile) => {
      const person = profile.person
      const enrollment = profile.enrollments[0]
      const assignment = profile.assignments[0]
      const subscription = assignment?.subscription

      // Use shared contact helpers
      const email = extractStudentEmail({ person })
      const phone = extractStudentPhone({ person })

      return {
        id: profile.id,
        personId: profile.personId,
        name: person.name,
        email,
        phone,
        dateOfBirth: person.dateOfBirth?.toISOString() ?? null,
        gradeLevel: profile.gradeLevel,
        schoolName: profile.schoolName,
        // Mahad billing fields
        graduationStatus: profile.graduationStatus,
        paymentFrequency: profile.paymentFrequency,
        billingType: profile.billingType,
        paymentNotes: profile.paymentNotes,
        status: profile.status,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status: enrollment.status,
              startDate: enrollment.startDate.toISOString(),
              endDate: enrollment.endDate?.toISOString() ?? null,
              batchId: enrollment.batch?.id ?? null,
              batchName: enrollment.batch?.name ?? null,
            }
          : null,
        subscription: subscription
          ? {
              id: subscription.id,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              stripeCustomerId: subscription.stripeCustomerId,
              status: subscription.status,
              amount: subscription.amount,
            }
          : null,
        siblings: siblingMap.get(profile.personId) || [],
      }
    })

    return {
      success: true,
      data: {
        exportDate: new Date().toISOString(),
        recordCount: students.length,
        students,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to export backup data')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export data',
    }
  }
}
