'use server'

/**
 * Batch Data Actions
 *
 * Query functions for batch/cohort data and duplicate detection.
 * Uses existing services and queries.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import { mahadEnrollmentInclude } from '@/lib/mappers/mahad-mapper'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BatchStudentData {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  educationLevel: EducationLevel | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  status: string
  createdAt: string
  updatedAt: string
  batch: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
  } | null
  siblingGroup: {
    id: string
    students: {
      id: string
      name: string
      status: string
    }[]
  } | null
}

export interface DuplicateStudentGroup {
  email: string
  count: number
  students: Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
    status: string
    createdAt: Date
  }>
}

// ============================================================================
// MAIN QUERY FUNCTIONS
// ============================================================================

/**
 * Get all Mahad students with batch and sibling information
 *
 * Used for batch management and reporting.
 */
export async function getBatchData(): Promise<BatchStudentData[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      programProfile: {
        program: MAHAD_PROGRAM,
      },
      status: { not: 'WITHDRAWN' },
      endDate: null,
    },
    include: {
      ...mahadEnrollmentInclude,
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
          assignments: {
            where: { isActive: true },
            include: {
              subscription: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  // Build sibling groups
  const siblingGroupMap = new Map<
    string,
    {
      id: string
      students: Array<{ id: string; name: string; status: string }>
    }
  >()

  for (const enrollment of enrollments) {
    const personId = enrollment.programProfile.personId
    const siblings = await getPersonSiblings(personId)

    if (siblings.length > 0) {
      // Create a group ID from sorted person IDs
      const allPersonIds = [
        personId,
        ...siblings.map((s) => s.person.id),
      ].sort()
      const groupId = allPersonIds.join('_')

      if (!siblingGroupMap.has(groupId)) {
        const groupStudents: Array<{
          id: string
          name: string
          status: string
        }> = []

        // Add current student
        groupStudents.push({
          id: enrollment.programProfile.id,
          name: enrollment.programProfile.person.name,
          status: enrollment.status,
        })

        // Add siblings
        for (const sibling of siblings) {
          const mahadProfile = sibling.profiles.find(
            (p) => p.program === MAHAD_PROGRAM
          )
          if (mahadProfile) {
            const siblingEnrollment = mahadProfile.enrollments[0]
            groupStudents.push({
              id: mahadProfile.id,
              name: sibling.person.name,
              status: siblingEnrollment?.status || 'REGISTERED',
            })
          }
        }

        siblingGroupMap.set(groupId, {
          id: groupId,
          students: groupStudents,
        })
      }
    }
  }

  // Map enrollments to BatchStudentData
  return enrollments.map((enrollment) => {
    const profile = enrollment.programProfile
    const person = profile.person

    const emailContact = person.contactPoints?.find((cp) => cp.type === 'EMAIL')
    const phoneContact = person.contactPoints?.find(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )

    // Find sibling group
    let siblingGroup: {
      id: string
      students: Array<{ id: string; name: string; status: string }>
    } | null = null
    siblingGroupMap.forEach((group) => {
      if (!siblingGroup && group.students.some((s) => s.id === profile.id)) {
        siblingGroup = group
      }
    })

    return {
      id: profile.id,
      name: person.name,
      email: emailContact?.value ?? null,
      phone: phoneContact?.value ?? null,
      dateOfBirth: person.dateOfBirth?.toISOString() ?? null,
      educationLevel: profile.educationLevel,
      gradeLevel: profile.gradeLevel,
      schoolName: profile.schoolName,
      status: enrollment.status,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      batch: enrollment.batch
        ? {
            id: enrollment.batch.id,
            name: enrollment.batch.name,
            startDate: enrollment.batch.startDate?.toISOString() ?? null,
            endDate: enrollment.batch.endDate?.toISOString() ?? null,
          }
        : null,
      siblingGroup,
    }
  })
}

/**
 * Find potential duplicate students
 *
 * Groups students by email to identify duplicates.
 */
export async function getDuplicateStudents(): Promise<DuplicateStudentGroup[]> {
  // Find emails with multiple persons
  const duplicateEmails = await prisma.contactPoint.groupBy({
    by: ['value'],
    where: {
      type: 'EMAIL',
    },
    _count: {
      value: true,
    },
    having: {
      value: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  const duplicateGroups: DuplicateStudentGroup[] = []

  for (const dup of duplicateEmails) {
    // Get all persons with this email
    const contactPoints = await prisma.contactPoint.findMany({
      where: {
        type: 'EMAIL',
        value: dup.value,
      },
      include: {
        person: {
          include: {
            contactPoints: true,
            programProfiles: {
              where: {
                program: MAHAD_PROGRAM,
              },
              include: {
                enrollments: {
                  where: {
                    status: { not: 'WITHDRAWN' },
                    endDate: null,
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    const students = contactPoints
      .filter((cp) => cp.person.programProfiles.length > 0)
      .map((cp) => {
        const profile = cp.person.programProfiles[0]
        const phoneContact = cp.person.contactPoints.find(
          (c) => c.type === 'PHONE' || c.type === 'WHATSAPP'
        )

        return {
          id: profile.id,
          name: cp.person.name,
          email: dup.value,
          phone: phoneContact?.value ?? null,
          status: profile.enrollments[0]?.status || 'REGISTERED',
          createdAt: profile.createdAt,
        }
      })

    if (students.length > 1) {
      duplicateGroups.push({
        email: dup.value,
        count: students.length,
        students,
      })
    }
  }

  return duplicateGroups
}

/**
 * Delete/merge duplicate records
 *
 * Keeps the oldest record and merges data from newer duplicates.
 * THIS IS A DESTRUCTIVE OPERATION - use with caution.
 */
export async function deleteDuplicateRecords(
  profileIds: string[]
): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    if (profileIds.length === 0) {
      return { success: true, deleted: 0 }
    }

    // Verify all profiles exist and are Mahad profiles
    const profiles = await prisma.programProfile.findMany({
      where: {
        id: { in: profileIds },
        program: MAHAD_PROGRAM,
      },
    })

    if (profiles.length !== profileIds.length) {
      return {
        success: false,
        deleted: 0,
        error: 'Some profiles not found or not Mahad profiles',
      }
    }

    // Soft delete by marking as withdrawn
    await prisma.$transaction(async (tx) => {
      // Withdraw enrollments
      await tx.enrollment.updateMany({
        where: {
          programProfileId: { in: profileIds },
          status: { not: 'WITHDRAWN' },
        },
        data: {
          status: 'WITHDRAWN',
          endDate: new Date(),
          reason: 'Duplicate record cleanup',
        },
      })

      // Mark profiles as withdrawn
      await tx.programProfile.updateMany({
        where: {
          id: { in: profileIds },
        },
        data: {
          status: 'WITHDRAWN',
        },
      })
    })

    return { success: true, deleted: profileIds.length }
  } catch (error) {
    console.error('Delete duplicate records error:', error)
    return {
      success: false,
      deleted: 0,
      error:
        error instanceof Error ? error.message : 'Failed to delete records',
    }
  }
}
