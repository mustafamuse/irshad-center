'use server'

import { cache } from 'react'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

// Enums and constants
export enum StudentStatus {
  REGISTERED = 'registered',
  ENROLLED = 'enrolled',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

const BASE_RATE = 150

type StudentWithRelations = Prisma.StudentGetPayload<{
  include: {
    Batch: {
      select: {
        id: true
        name: true
      }
    }
    Sibling: {
      select: {
        id: true
        Student: {
          select: {
            id: true
            name: true
            monthlyRate: true
          }
        }
      }
    }
  }
}>

// Our DTO for the frontend
export interface StudentDTO {
  id: string
  name: string
  monthlyRate: number
  hasCustomRate: boolean
  status: StudentStatus
  siblingGroupId: string | null
  batchId: string | null
  batchName: string | null
  email: string | null
  phone: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  // Computed fields
  isEligibleForAutopay: boolean
  hasActiveSubscription: boolean
  familyDiscount: {
    applied: boolean
    amount: number
    siblingCount: number
  }
}

interface StudentQueryOptions {
  includeInactive?: boolean
  includeBatchInfo?: boolean
  siblingGroupId?: string
}

// Async mapper function for server components
async function mapToDTO(student: StudentWithRelations): Promise<StudentDTO> {
  const siblingCount = student.Sibling?.Student.length ?? 0
  const hasActiveSubscription =
    student.stripeSubscriptionId !== null &&
    student.subscriptionStatus === 'active'

  // Calculate tiered discount based on number of siblings
  let discount = 0
  if (!student.customRate && siblingCount > 1) {
    // Tiered discount calculation:
    // 2 siblings → $10 off each ($140 per student)
    // 3 siblings → $15 off each ($135 per student)
    // 4 siblings → $20 off each ($130 per student)
    discount = (siblingCount - 1) * 5 + 5
  }

  // Use custom rate if set, otherwise apply BASE_RATE with discount
  const calculatedRate = student.customRate
    ? student.monthlyRate
    : BASE_RATE - discount

  return {
    id: student.id,
    name: student.name,
    monthlyRate: calculatedRate,
    hasCustomRate: student.customRate,
    status: student.status as StudentStatus,
    siblingGroupId: student.siblingGroupId,
    batchId: student.Batch?.id ?? null,
    batchName: student.Batch?.name ?? null,
    email: student.email,
    phone: student.phone,
    stripeCustomerId: student.stripeCustomerId,
    stripeSubscriptionId: student.stripeSubscriptionId,
    subscriptionStatus: student.subscriptionStatus || null,
    // Computed fields
    isEligibleForAutopay: !hasActiveSubscription,
    hasActiveSubscription,
    familyDiscount: {
      applied: siblingCount > 1 && !student.customRate,
      amount: discount,
      siblingCount,
    },
  }
}

// Main query function
export const getStudents = cache(async (options: StudentQueryOptions = {}) => {
  console.log('🔍 Calling getStudents with options:', options)

  try {
    const students = await prisma.student.findMany({
      where: {
        // Only include students without active subscriptions for enrollment
        ...(options.includeInactive
          ? {}
          : {
              OR: [
                { stripeSubscriptionId: null },
                { subscriptionStatus: { not: 'active' } },
              ],
            }),
        status: options.includeInactive ? undefined : StudentStatus.REGISTERED,
        ...(options.siblingGroupId && {
          siblingGroupId: options.siblingGroupId,
        }),
      },
      include: {
        Batch: {
          select: {
            id: true,
            name: true,
          },
        },
        Sibling: {
          select: {
            id: true,
            Student: {
              select: {
                id: true,
                name: true,
                monthlyRate: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Map all students to DTOs
    return await Promise.all(students.map(mapToDTO))
  } catch (error) {
    console.error('Error fetching students:', error)
    throw error
  }
})

// Helper functions
export async function getEligibleStudentsForAutopay() {
  return getStudents({
    includeInactive: false,
    includeBatchInfo: true,
  })
}

export async function getSiblings(siblingGroupId: string) {
  return getStudents({
    siblingGroupId,
    includeBatchInfo: true,
  })
}

export async function getAllStudents() {
  return getStudents({
    includeInactive: true,
    includeBatchInfo: true,
  })
}
