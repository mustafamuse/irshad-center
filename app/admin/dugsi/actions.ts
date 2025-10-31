'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { extractPeriodDates } from '@/lib/utils/type-guards'

export async function getDugsiRegistrations() {
  const students = await prisma.student.findMany({
    where: { program: 'DUGSI_PROGRAM' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      gender: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      healthInfo: true,
      createdAt: true,
      parentFirstName: true,
      parentLastName: true,
      parentEmail: true,
      parentPhone: true,
      parent2FirstName: true,
      parent2LastName: true,
      parent2Email: true,
      parent2Phone: true,
      // Payment fields
      paymentMethodCaptured: true,
      paymentMethodCapturedAt: true,
      stripeCustomerIdDugsi: true,
      stripeSubscriptionIdDugsi: true,
      subscriptionStatus: true,
      paidUntil: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      familyReferenceId: true,
      stripeAccountType: true,
    },
  })

  return students
}

export async function getFamilyMembers(studentId: string) {
  // Get the selected student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      parentPhone: true,
      parent2Phone: true,
    },
  })

  if (!student) return []

  // Find all siblings (students with the same parent phone number)
  const phoneNumbers = [student.parentPhone, student.parent2Phone].filter(
    Boolean
  )

  if (phoneNumbers.length === 0) return []

  const siblings = await prisma.student.findMany({
    where: {
      program: 'DUGSI_PROGRAM',
      OR: phoneNumbers.map((phone) => ({
        OR: [{ parentPhone: phone }, { parent2Phone: phone }],
      })),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      gender: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      healthInfo: true,
      createdAt: true,
      parentFirstName: true,
      parentLastName: true,
      parentEmail: true,
      parentPhone: true,
      parent2FirstName: true,
      parent2LastName: true,
      parent2Email: true,
      parent2Phone: true,
      // Payment fields
      paymentMethodCaptured: true,
      paymentMethodCapturedAt: true,
      stripeCustomerIdDugsi: true,
      stripeSubscriptionIdDugsi: true,
      subscriptionStatus: true,
      paidUntil: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      familyReferenceId: true,
      stripeAccountType: true,
    },
  })

  return siblings
}

export async function deleteDugsiFamily(studentId: string) {
  try {
    // Get the student to find family members
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        parentPhone: true,
        parent2Phone: true,
      },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Find all phone numbers to identify the family
    const phoneNumbers = [student.parentPhone, student.parent2Phone].filter(
      Boolean
    )

    if (phoneNumbers.length === 0) {
      // If no phone numbers, just delete the single student
      await prisma.student.delete({
        where: { id: studentId },
      })
    } else {
      // Delete all family members (students with matching phone numbers)
      await prisma.student.deleteMany({
        where: {
          program: 'DUGSI_PROGRAM',
          OR: phoneNumbers.map((phone) => ({
            OR: [{ parentPhone: phone }, { parent2Phone: phone }],
          })),
        },
      })
    }

    // Revalidate the page to show updated data
    revalidatePath('/admin/dugsi')

    return { success: true }
  } catch (error) {
    console.error('Error deleting family:', error)
    return { success: false, error: 'Failed to delete family' }
  }
}

/**
 * Link a manually created Stripe subscription to a Dugsi family.
 * This allows admins to create subscriptions in Stripe Dashboard
 * and then connect them back to the family records.
 */
export async function linkDugsiSubscription(params: {
  parentEmail: string
  subscriptionId: string
}) {
  try {
    const { parentEmail, subscriptionId } = params

    // Validate parentEmail is not null/empty to prevent matching all null emails
    if (!parentEmail || parentEmail.trim() === '') {
      return {
        success: false,
        error:
          'Parent email is required to link subscription. Please update the student record with a parent email first.',
      }
    }

    // Validate the subscription exists in Stripe
    const dugsiStripe = getDugsiStripeClient()
    const subscription =
      await dugsiStripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      return { success: false, error: 'Subscription not found in Stripe' }
    }

    // Extract customer ID (type guard ensures it's a string)
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, error: 'Invalid customer ID in subscription' }
    }

    // Derive student status from subscription status
    const newStudentStatus = getNewStudentStatus(subscription.status)

    // Extract period dates
    const periodDates = extractPeriodDates(subscription)

    // Use transaction to atomically update all students in the family
    const studentsToUpdate = await prisma.$transaction(async (tx) => {
      // Find all students to update and track history
      const students = await tx.student.findMany({
        where: {
          parentEmail,
          program: 'DUGSI_PROGRAM',
        },
        select: {
          id: true,
          stripeSubscriptionIdDugsi: true,
          subscriptionStatus: true,
        },
      })

      if (students.length === 0) {
        return []
      }

      // Update each student individually to track subscription history
      await Promise.all(
        students.map((student) => {
          const oldSubscriptionId = student.stripeSubscriptionIdDugsi
          const statusChanged =
            student.subscriptionStatus !== subscription.status

          const updateData: {
            stripeSubscriptionIdDugsi: string
            stripeCustomerIdDugsi: string
            subscriptionStatus:
              | 'active'
              | 'canceled'
              | 'past_due'
              | 'unpaid'
              | 'trialing'
              | 'incomplete'
              | 'incomplete_expired'
              | 'paused'
            status: string
            stripeAccountType: 'DUGSI'
            paidUntil: Date | null
            currentPeriodStart: Date | null
            currentPeriodEnd: Date | null
            subscriptionStatusUpdatedAt?: Date
            previousSubscriptionIdsDugsi?: { push: string }
          } = {
            stripeSubscriptionIdDugsi: subscriptionId,
            stripeCustomerIdDugsi: customerId,
            subscriptionStatus: subscription.status as
              | 'active'
              | 'canceled'
              | 'past_due'
              | 'unpaid'
              | 'trialing'
              | 'incomplete'
              | 'incomplete_expired'
              | 'paused',
            status: newStudentStatus,
            stripeAccountType: 'DUGSI',
            paidUntil: periodDates.periodEnd ?? null,
            currentPeriodStart: periodDates.periodStart,
            currentPeriodEnd: periodDates.periodEnd,
            // Only update timestamp if status actually changed
            ...(statusChanged && {
              subscriptionStatusUpdatedAt: new Date(),
            }),
          }

          // Add old subscription ID to history if it exists and is different
          if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
            updateData.previousSubscriptionIdsDugsi = {
              push: oldSubscriptionId,
            }
          }

          return tx.student.update({
            where: { id: student.id },
            data: updateData,
          })
        })
      )

      return students
    })

    if (studentsToUpdate.length === 0) {
      return {
        success: false,
        error: 'No students found with this parent email',
      }
    }

    // Revalidate the admin page
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      updated: studentsToUpdate.length,
      message: `Successfully linked subscription to ${studentsToUpdate.length} students`,
    }
  } catch (error) {
    console.error('Error linking Dugsi subscription:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to link subscription',
    }
  }
}

/**
 * Get payment status for a Dugsi family.
 * Useful for admins to see if payment method has been captured.
 */
export async function getDugsiPaymentStatus(parentEmail: string) {
  try {
    const students = await prisma.student.findMany({
      where: {
        parentEmail,
        program: 'DUGSI_PROGRAM',
      },
      select: {
        id: true,
        name: true,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: true,
        stripeCustomerIdDugsi: true,
        stripeSubscriptionIdDugsi: true,
        subscriptionStatus: true,
        paidUntil: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    })

    if (students.length === 0) {
      return { success: false, error: 'No students found for this email' }
    }

    // Check if any student has payment method captured
    const hasPaymentMethod = students.some((s) => s.paymentMethodCaptured)
    const hasSubscription = students.some((s) => s.stripeSubscriptionIdDugsi)

    return {
      success: true,
      data: {
        familyEmail: parentEmail,
        studentCount: students.length,
        hasPaymentMethod,
        hasSubscription,
        stripeCustomerId: students[0]?.stripeCustomerIdDugsi,
        subscriptionId: students[0]?.stripeSubscriptionIdDugsi,
        subscriptionStatus: students[0]?.subscriptionStatus,
        paidUntil: students[0]?.paidUntil,
        currentPeriodStart: students[0]?.currentPeriodStart,
        currentPeriodEnd: students[0]?.currentPeriodEnd,
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
    }
  } catch (error) {
    console.error('Error getting payment status:', error)
    return {
      success: false,
      error: 'Failed to get payment status',
    }
  }
}
