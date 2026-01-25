'use server'

/**
 * Batch Data Actions
 *
 * Query functions for batch/cohort data and duplicate detection.
 * Uses existing services and queries.
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { createActionLogger, logError } from '@/lib/logger'
import {
  mahadEnrollmentInclude,
  extractStudentEmail,
  extractStudentPhone,
} from '@/lib/mappers/mahad-mapper'

const logger = createActionLogger('batch-data')

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BatchStudentData {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  // Mahad billing fields
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null
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
  // Single query with nested sibling relationships (optimized from 2 queries)
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
              // Include both directions of sibling relationships
              siblingRelationships1: {
                where: { isActive: true },
                include: {
                  person2: {
                    include: {
                      programProfiles: {
                        where: { program: MAHAD_PROGRAM },
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
              },
              siblingRelationships2: {
                where: { isActive: true },
                include: {
                  person1: {
                    include: {
                      programProfiles: {
                        where: { program: MAHAD_PROGRAM },
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
              },
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

  // Build sibling map from nested includes (no second query needed)
  const siblingMap = new Map<string, Set<string>>()
  const personInfoMap = new Map<
    string,
    { profileId: string; name: string; status: string }
  >()

  for (const enrollment of enrollments) {
    const person = enrollment.programProfile.person
    const personId = enrollment.programProfile.personId

    // Add this person to the lookup
    if (!personInfoMap.has(personId)) {
      personInfoMap.set(personId, {
        profileId: enrollment.programProfile.id,
        name: person.name,
        status: enrollment.status,
      })
    }

    // Process siblingRelationships1 (this person is person1)
    for (const rel of person.siblingRelationships1) {
      if (!siblingMap.has(personId)) siblingMap.set(personId, new Set())
      siblingMap.get(personId)!.add(rel.person2Id)

      const siblingProfile = rel.person2.programProfiles[0]
      if (siblingProfile && !personInfoMap.has(rel.person2Id)) {
        personInfoMap.set(rel.person2Id, {
          profileId: siblingProfile.id,
          name: rel.person2.name,
          status: siblingProfile.enrollments[0]?.status || 'REGISTERED',
        })
      }
    }

    // Process siblingRelationships2 (this person is person2)
    for (const rel of person.siblingRelationships2) {
      if (!siblingMap.has(personId)) siblingMap.set(personId, new Set())
      siblingMap.get(personId)!.add(rel.person1Id)

      const siblingProfile = rel.person1.programProfiles[0]
      if (siblingProfile && !personInfoMap.has(rel.person1Id)) {
        personInfoMap.set(rel.person1Id, {
          profileId: siblingProfile.id,
          name: rel.person1.name,
          status: siblingProfile.enrollments[0]?.status || 'REGISTERED',
        })
      }
    }
  }

  // Build sibling groups with stable IDs
  const siblingGroupMap = new Map<
    string,
    {
      id: string
      students: Array<{ id: string; name: string; status: string }>
    }
  >()

  for (const enrollment of enrollments) {
    const personId = enrollment.programProfile.personId
    const siblingIds = siblingMap.get(personId)

    if (siblingIds && siblingIds.size > 0) {
      // Create stable group ID from sorted person IDs
      const allPersonIds = [personId, ...Array.from(siblingIds)].sort()
      const groupId = allPersonIds.join('_')

      if (!siblingGroupMap.has(groupId)) {
        const groupStudents: Array<{
          id: string
          name: string
          status: string
        }> = []

        for (const pid of allPersonIds) {
          const info = personInfoMap.get(pid)
          if (info) {
            groupStudents.push({
              id: info.profileId,
              name: info.name,
              status: info.status,
            })
          }
        }

        siblingGroupMap.set(groupId, { id: groupId, students: groupStudents })
      }
    }
  }

  // Build reverse index: profileId → group (O(1) lookup instead of O(n*m))
  const profileToGroupMap = new Map<
    string,
    {
      id: string
      students: Array<{ id: string; name: string; status: string }>
    }
  >()
  siblingGroupMap.forEach((group) => {
    group.students.forEach((student) => {
      profileToGroupMap.set(student.id, group)
    })
  })

  // Map enrollments to BatchStudentData
  return enrollments.map((enrollment) => {
    const profile = enrollment.programProfile
    const person = profile.person

    // Use shared contact helpers
    const email = extractStudentEmail({ person })
    const phone = extractStudentPhone({ person })

    // Find sibling group using O(1) lookup
    const siblingGroup = profileToGroupMap.get(profile.id) ?? null

    return {
      id: profile.id,
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
 * Find potential duplicate students by email
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
 * Withdraw duplicate records (soft delete)
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
    await logError(logger, error, 'Failed to delete duplicate records', {
      profileIds,
    })
    return {
      success: false,
      deleted: 0,
      error:
        error instanceof Error ? error.message : 'Failed to delete records',
    }
  }
}
