'use server'

import { prisma } from '@/lib/db'

// Re-export BatchStudentData from the centralized types file
export type { BatchStudentData } from '@/lib/types/batch'

/**
 * Get all batch student data with full details
 * Used by VCard generator and student validation utilities
 */
export async function getBatchData() {
  const profiles = await prisma.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
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
        },
        include: {
          batch: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: true,
        },
      },
    },
  })

  // Transform to BatchStudentData format expected by utilities
  return profiles.map((profile) => {
    const person = profile.person
    const enrollment = profile.enrollments[0] // Get active enrollment
    const email = person.contactPoints.find((cp) => cp.type === 'EMAIL')
    const phone = person.contactPoints.find(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )

    return {
      id: profile.id,
      name: person.name,
      email: email?.value ?? null,
      phone: phone?.value ?? null,
      dateOfBirth: person.dateOfBirth,
      educationLevel: profile.educationLevel,
      gradeLevel: profile.gradeLevel,
      schoolName: profile.schoolName,
      monthlyRate: profile.monthlyRate,
      customRate: profile.customRate,
      status: profile.status,
      batchId: enrollment?.batchId ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      batch: enrollment?.batch ?? null,
      subscription: profile.assignments[0]?.subscription
        ? {
            id: profile.assignments[0].subscription.id,
            status: profile.assignments[0].subscription.status,
            stripeSubscriptionId:
              profile.assignments[0].subscription.stripeSubscriptionId,
            amount: profile.assignments[0].subscription.amount,
          }
        : null,
      siblingCount: 0, // TODO: Implement sibling count if needed
    }
  })
}

/**
 * Find duplicate students based on:
 * - Same email address
 * - Same phone number
 * - Same name + date of birth combination
 */
export async function getDuplicateStudents() {
  // Find duplicate emails
  const duplicateEmails = await prisma.contactPoint.groupBy({
    by: ['value'],
    where: {
      type: 'EMAIL',
    },
    having: {
      value: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  // Find duplicate phones
  const duplicatePhones = await prisma.contactPoint.groupBy({
    by: ['value'],
    where: {
      type: { in: ['PHONE', 'WHATSAPP'] },
    },
    having: {
      value: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  // Get full person details for duplicates
  const duplicateEmailValues = duplicateEmails.map((d) => d.value)
  const duplicatePhoneValues = duplicatePhones.map((d) => d.value)

  const duplicatePersonsByContact = await prisma.person.findMany({
    where: {
      contactPoints: {
        some: {
          value: {
            in: [...duplicateEmailValues, ...duplicatePhoneValues],
          },
        },
      },
    },
    include: {
      contactPoints: true,
      programProfiles: {
        include: {
          enrollments: true,
        },
      },
    },
  })

  // Find duplicates by name + DOB
  const allPersons = await prisma.person.findMany({
    where: {
      dateOfBirth: { not: null },
    },
    include: {
      contactPoints: true,
      programProfiles: true,
    },
  })

  // Group by name + DOB
  const nameDobGroups = new Map<string, typeof allPersons>()
  for (const person of allPersons) {
    if (person.dateOfBirth) {
      const key = `${person.name.toLowerCase()}_${person.dateOfBirth.toISOString()}`
      const existing = nameDobGroups.get(key) || []
      nameDobGroups.set(key, [...existing, person])
    }
  }

  const duplicatesByNameDob = Array.from(nameDobGroups.values()).filter(
    (group) => group.length > 1
  )

  return {
    byEmail: duplicateEmailValues.map((email) => ({
      value: email,
      persons: duplicatePersonsByContact.filter((p) =>
        p.contactPoints.some((cp) => cp.value === email)
      ),
    })),
    byPhone: duplicatePhoneValues.map((phone) => ({
      value: phone,
      persons: duplicatePersonsByContact.filter((p) =>
        p.contactPoints.some((cp) => cp.value === phone)
      ),
    })),
    byNameDob: duplicatesByNameDob.map((group) => ({
      name: group[0].name,
      dateOfBirth: group[0].dateOfBirth,
      persons: group,
    })),
  }
}

/**
 * Delete duplicate person records
 * Only deletes if person has no active enrollments or billing
 */
export async function deleteDuplicateRecords(personIds: string[]) {
  const results = {
    deleted: [] as string[],
    skipped: [] as { id: string; reason: string }[],
  }

  for (const personId of personIds) {
    // Check if person has active enrollments
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        programProfiles: {
          include: {
            enrollments: {
              where: {
                status: { not: 'WITHDRAWN' },
              },
            },
            assignments: {
              where: { isActive: true },
            },
            payments: true,
          },
        },
      },
    })

    if (!person) {
      results.skipped.push({ id: personId, reason: 'Person not found' })
      continue
    }

    // Check if safe to delete
    const hasActiveEnrollments = person.programProfiles.some(
      (p) => p.enrollments.length > 0
    )
    const hasBilling = person.programProfiles.some(
      (p) => p.assignments.length > 0
    )
    const hasPayments = person.programProfiles.some(
      (p) => p.payments.length > 0
    )

    if (hasActiveEnrollments || hasBilling || hasPayments) {
      results.skipped.push({
        id: personId,
        reason: 'Has active enrollments, billing, or payment history',
      })
      continue
    }

    // Safe to delete - cascade will handle related records
    await prisma.person.delete({
      where: { id: personId },
    })

    results.deleted.push(personId)
  }

  return results
}
