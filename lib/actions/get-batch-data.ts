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
import {
  mahadEnrollmentInclude,
  extractStudentEmail,
  extractStudentPhone,
} from '@/lib/mappers/mahad-mapper'

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

  // Build sibling groups using batch query (fixes N+1)
  // Fetch all sibling relationships for enrolled persons in one query
  const personIds = enrollments.map((e) => e.programProfile.personId)

  const siblingRelationships = await prisma.siblingRelationship.findMany({
    where: {
      isActive: true,
      OR: [{ person1Id: { in: personIds } }, { person2Id: { in: personIds } }],
    },
    include: {
      person1: {
        include: {
          programProfiles: {
            where: { program: MAHAD_PROGRAM },
            include: {
              enrollments: {
                where: { status: { not: 'WITHDRAWN' }, endDate: null },
                take: 1,
              },
            },
          },
        },
      },
      person2: {
        include: {
          programProfiles: {
            where: { program: MAHAD_PROGRAM },
            include: {
              enrollments: {
                where: { status: { not: 'WITHDRAWN' }, endDate: null },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  // Build sibling map: personId -> array of sibling person IDs
  const siblingMap = new Map<string, Set<string>>()
  for (const rel of siblingRelationships) {
    // Add bidirectional relationships
    if (!siblingMap.has(rel.person1Id)) siblingMap.set(rel.person1Id, new Set())
    if (!siblingMap.has(rel.person2Id)) siblingMap.set(rel.person2Id, new Set())
    siblingMap.get(rel.person1Id)!.add(rel.person2Id)
    siblingMap.get(rel.person2Id)!.add(rel.person1Id)
  }

  // Build person info lookup from relationships
  const personInfoMap = new Map<
    string,
    { profileId: string; name: string; status: string }
  >()
  for (const rel of siblingRelationships) {
    for (const person of [rel.person1, rel.person2]) {
      const mahadProfile = person.programProfiles[0]
      if (mahadProfile && !personInfoMap.has(person.id)) {
        personInfoMap.set(person.id, {
          profileId: mahadProfile.id,
          name: person.name,
          status: mahadProfile.enrollments[0]?.status || 'REGISTERED',
        })
      }
    }
  }

  // Also add enrolled students to the lookup
  for (const enrollment of enrollments) {
    const person = enrollment.programProfile.person
    if (!personInfoMap.has(enrollment.programProfile.personId)) {
      personInfoMap.set(enrollment.programProfile.personId, {
        profileId: enrollment.programProfile.id,
        name: person.name,
        status: enrollment.status,
      })
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

  // Map enrollments to BatchStudentData
  return enrollments.map((enrollment) => {
    const profile = enrollment.programProfile
    const person = profile.person

    // Use shared contact helpers
    const email = extractStudentEmail({ person })
    const phone = extractStudentPhone({ person })

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
      email,
      phone,
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
 *
 * Limitations:
 * - Only detects duplicates based on exact email matches
 * - Does not detect duplicates with: same name but different emails,
 *   typos in emails, or multiple accounts for the same person
 * - Future versions could add fuzzy name matching or phone number matching
 *
 * @returns Array of duplicate groups, each containing students sharing the same email
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
 *
 * Marks the specified profiles as WITHDRAWN rather than hard-deleting them.
 * This is reversible but should be used with caution.
 *
 * What it does:
 * - Sets enrollment.reason to 'Duplicate record cleanup'
 * - Sets profile status to WITHDRAWN
 *
 * @param profileIds - Array of ProgramProfile IDs to withdraw
 * @returns Object with success status and count of withdrawn records
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
