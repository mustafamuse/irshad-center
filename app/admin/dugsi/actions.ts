'use server'

import { revalidatePath } from 'next/cache'

import {
  EducationLevel,
  GradeLevel,
  SubscriptionStatus,
  StripeAccountType,
} from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getBillingAssignmentsByProfile,
  getSubscriptionByStripeId,
} from '@/lib/db/queries/billing'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
  findPersonByContact,
} from '@/lib/db/queries/program-profile'
import { constructDugsiPaymentUrl } from '@/lib/stripe-dugsi'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { isValidEmail, extractPeriodDates } from '@/lib/utils/type-guards'

import {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
} from './_types'

/**
 * Helper function to map ProgramProfile with relations to DugsiRegistration format
 * Accepts profiles with or without guardianRelationships (from getProgramProfileById or direct Prisma queries)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileToDugsiRegistration(profile: any): DugsiRegistration | null {
  if (!profile || profile.program !== 'DUGSI_PROGRAM') return null

  const person = profile.person

  // Extract parent contact info from guardian relationships
  const guardianRelationships = (person.guardianRelationships || []) as Array<{
    guardian: {
      name: string | null
      contactPoints?: Array<{ type: string; value: string }>
    } | null
  }>
  const guardians = guardianRelationships
    .map(
      (rel: {
        guardian: {
          name: string | null
          contactPoints?: Array<{ type: string; value: string }>
        } | null
      }) => rel.guardian
    )
    .filter(Boolean)

  // Get primary parent (first guardian) contact info
  const parent1 = guardians[0] as
    | {
        name: string | null
        contactPoints?: Array<{ type: string; value: string }>
      }
    | undefined
  const parent1Email =
    parent1?.contactPoints?.find(
      (cp: { type: string; value: string }) => cp.type === 'EMAIL'
    )?.value || null
  const parent1Phone =
    parent1?.contactPoints?.find(
      (cp: { type: string; value: string }) =>
        cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )?.value || null
  const parent1Name = parent1?.name || null
  const [parent1FirstName, parent1LastName] = parent1Name
    ? parent1Name.split(' ').slice(0, 2)
    : [null, null]

  // Get second parent (second guardian) contact info
  const parent2 = guardians[1] as
    | {
        name: string | null
        contactPoints?: Array<{ type: string; value: string }>
      }
    | undefined
  const parent2Email =
    parent2?.contactPoints?.find(
      (cp: { type: string; value: string }) => cp.type === 'EMAIL'
    )?.value || null
  const parent2Phone =
    parent2?.contactPoints?.find(
      (cp: { type: string; value: string }) =>
        cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )?.value || null
  const parent2Name = parent2?.name || null
  const [parent2FirstName, parent2LastName] = parent2Name
    ? parent2Name.split(' ').slice(0, 2)
    : [null, null]

  // Get billing info from assignments
  const activeAssignment = profile.assignments?.[0]
  const subscription = activeAssignment?.subscription
  const billingAccount = subscription?.billingAccount

  return {
    id: profile.id,
    name: person.name,
    gender: profile.gender,
    dateOfBirth: person.dateOfBirth,
    educationLevel: profile.educationLevel,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    healthInfo: profile.healthInfo,
    createdAt: profile.createdAt,
    parentFirstName: parent1FirstName,
    parentLastName: parent1LastName,
    parentEmail: parent1Email,
    parentPhone: parent1Phone,
    parent2FirstName: parent2FirstName,
    parent2LastName: parent2LastName,
    parent2Email: parent2Email,
    parent2Phone: parent2Phone,
    paymentMethodCaptured: billingAccount?.paymentMethodCaptured || false,
    paymentMethodCapturedAt: billingAccount?.paymentMethodCapturedAt || null,
    stripeCustomerIdDugsi: billingAccount?.stripeCustomerIdDugsi || null,
    stripeSubscriptionIdDugsi: subscription?.stripeSubscriptionId || null,
    paymentIntentIdDugsi: billingAccount?.paymentIntentIdDugsi || null,
    subscriptionStatus: (subscription?.status as SubscriptionStatus) || null,
    paidUntil: subscription?.paidUntil || null,
    currentPeriodStart: subscription?.currentPeriodStart || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    familyReferenceId: profile.familyReferenceId,
    stripeAccountType:
      (billingAccount?.accountType as StripeAccountType) || null,
  }
}

export async function getDugsiRegistrations(): Promise<DugsiRegistration[]> {
  // Fetch all profiles with full relations in a single query to avoid N+1
  const profiles = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
    },
    include: {
      person: {
        include: {
          contactPoints: true,
          guardianRelationships: {
            where: { isActive: true },
            include: {
              guardian: {
                include: {
                  contactPoints: true,
                },
              },
            },
          },
        },
      },
      enrollments: {
        include: {
          batch: true,
        },
        orderBy: {
          startDate: 'desc',
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          subscription: {
            include: {
              billingAccount: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const registrations: DugsiRegistration[] = []

  for (const profile of profiles) {
    // Type assertion: profiles from Prisma query have all necessary fields including guardianRelationships
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registration = mapProfileToDugsiRegistration(profile as any)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}

/**
 * Validate a Stripe subscription ID without linking it.
 * Used by the link subscription dialog to check if a subscription exists.
 */
export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionValidationData>> {
  try {
    if (!subscriptionId.startsWith('sub_')) {
      return {
        success: false,
        error: 'Invalid subscription ID format. Must start with "sub_"',
      }
    }

    // Validate the subscription exists in Stripe
    const dugsiStripe = getDugsiStripeClient()
    const subscription =
      await dugsiStripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      return { success: false, error: 'Subscription not found in Stripe' }
    }

    // Extract customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, error: 'Invalid customer ID in subscription' }
    }

    // Extract period dates using utility function
    const periodDates = extractPeriodDates(subscription)

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
      },
    }
  } catch (error) {
    console.error('Error validating Dugsi subscription:', error)
    if (error instanceof Error) {
      // Check if it's a Stripe error
      if (error.message.includes('No such subscription')) {
        return {
          success: false,
          error: 'Subscription not found in Stripe',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to validate subscription',
      }
    }
    return {
      success: false,
      error: 'Failed to validate subscription',
    }
  }
}

export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  const profile = await getProgramProfileById(studentId)
  if (!profile || profile.program !== 'DUGSI_PROGRAM') {
    return []
  }

  const familyId = profile.familyReferenceId
  if (!familyId) {
    // If no familyReferenceId, return just this student
    const registration = mapProfileToDugsiRegistration(profile)
    return registration ? [registration] : []
  }

  // Fetch all family profiles with full relations in a single query to avoid N+1
  const familyProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: 'DUGSI_PROGRAM',
    },
    include: {
      person: {
        include: {
          contactPoints: true,
          guardianRelationships: {
            where: { isActive: true },
            include: {
              guardian: {
                include: {
                  contactPoints: true,
                },
              },
            },
          },
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
          subscription: {
            include: {
              billingAccount: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const registrations: DugsiRegistration[] = []
  for (const familyProfile of familyProfiles) {
    // Type assertion: profiles from Prisma query have all necessary fields including guardianRelationships
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registration = mapProfileToDugsiRegistration(familyProfile as any)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}

/**
 * Get a preview of students that will be deleted when deleting a family.
 * This is used by the delete confirmation dialog to show which students will be affected.
 *
 * Returns the count and details of students that will be deleted based on the same
 * familyReferenceId-based matching logic used by deleteDugsiFamily().
 */
export async function getDeleteFamilyPreview(studentId: string): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string; parentEmail: string | null }>
  }>
> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    const familyId = profile.familyReferenceId
    let profilesToDelete = [profile]

    // If familyReferenceId exists, get all family members
    if (familyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profilesToDelete = (await getProgramProfilesByFamilyId(familyId)) as any
    }

    // Get parent email from guardian relationships
    const parentEmail =
      profile.person.guardianRelationships?.[0]?.guardian?.contactPoints?.find(
        (cp) => cp.type === 'EMAIL'
      )?.value || null

    const students = profilesToDelete.map((p) => ({
      id: p.id,
      name: p.person.name,
      parentEmail,
    }))

    return {
      success: true,
      data: {
        count: students.length,
        students,
      },
    }
  } catch (error) {
    console.error('Error getting delete family preview:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get delete preview',
    }
  }
}

export async function deleteDugsiFamily(
  studentId: string
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    const familyId = profile.familyReferenceId
    let profilesToDelete = [profile]

    // If familyReferenceId exists, get all family members
    if (familyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profilesToDelete = (await getProgramProfilesByFamilyId(familyId)) as any
    }

    // Soft delete by withdrawing all enrollments
    for (const profileToDelete of profilesToDelete) {
      const enrollments = profileToDelete.enrollments || []
      for (const enrollment of enrollments) {
        if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
          await updateEnrollmentStatus(
            enrollment.id,
            'WITHDRAWN',
            'Family deleted by admin'
          )
        }
      }
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting Dugsi family:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete family',
    }
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
}): Promise<ActionResult<SubscriptionLinkData>> {
  try {
    // Get subscription from database
    const subscription = await getSubscriptionByStripeId(params.subscriptionId)
    if (!subscription) {
      return {
        success: false,
        error: 'Subscription not found in database',
      }
    }

    // Find person by email (parent)
    const person = await prisma.person.findFirst({
      where: {
        contactPoints: {
          some: {
            type: 'EMAIL',
            value: params.parentEmail.toLowerCase().trim(),
          },
        },
      },
      include: {
        programProfiles: {
          where: {
            program: DUGSI_PROGRAM,
          },
        },
      },
    })

    if (!person) {
      return {
        success: false,
        error: 'Parent not found',
      }
    }

    // Get family profiles
    const profiles = person.programProfiles || []
    if (profiles.length === 0) {
      return {
        success: false,
        error: 'No Dugsi registrations found for this email',
      }
    }

    // Get family reference ID from first profile
    const familyId = profiles[0].familyReferenceId
    let familyProfiles = profiles

    // If familyReferenceId exists, get all family members
    if (familyId) {
      familyProfiles = await getProgramProfilesByFamilyId(familyId)
    }

    // Link subscription to all family profiles
    const { createBillingAssignment } = await import('@/lib/db/queries/billing')
    let updatedCount = 0

    // Calculate amounts to avoid rounding loss
    // Split evenly, but assign remainder to last profile to ensure total equals subscription amount
    const baseAmount = Math.floor(subscription.amount / familyProfiles.length)
    const remainder = subscription.amount - baseAmount * familyProfiles.length

    for (let i = 0; i < familyProfiles.length; i++) {
      const profile = familyProfiles[i]

      // Check if assignment already exists
      const existingAssignments = await getBillingAssignmentsByProfile(
        profile.id
      )
      const existingAssignment = existingAssignments.find(
        (a) => a.subscriptionId === subscription.id && a.isActive
      )

      if (!existingAssignment) {
        // Assign remainder to last profile to ensure total equals subscription amount
        const amount =
          i === familyProfiles.length - 1 ? baseAmount + remainder : baseAmount

        // Calculate percentage ensuring it sums to 100%
        const percentage =
          familyProfiles.length > 1
            ? (amount / subscription.amount) * 100
            : null

        await createBillingAssignment({
          subscriptionId: subscription.id,
          programProfileId: profile.id,
          amount,
          percentage,
          notes: 'Linked manually by admin',
        })
        updatedCount++
      }
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        updated: updatedCount,
      },
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
export async function getDugsiPaymentStatus(
  parentEmail: string
): Promise<ActionResult<PaymentStatusData>> {
  try {
    // Find person by email
    const person = await prisma.person.findFirst({
      where: {
        contactPoints: {
          some: {
            type: 'EMAIL',
            value: parentEmail.toLowerCase().trim(),
          },
        },
      },
      include: {
        contactPoints: true,
        programProfiles: {
          where: {
            program: DUGSI_PROGRAM,
          },
          include: {
            enrollments: {
              where: {
                status: { not: 'WITHDRAWN' },
                endDate: null,
              },
            },
            assignments: {
              where: { isActive: true },
              include: {
                subscription: {
                  include: {
                    billingAccount: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!person) {
      return {
        success: false,
        error: 'Family not found',
      }
    }

    const profiles = person.programProfiles || []
    if (profiles.length === 0) {
      return {
        success: false,
        error: 'No Dugsi registrations found for this email',
      }
    }

    // Get family reference ID from first profile
    const familyId = profiles[0].familyReferenceId

    // Always fetch family profiles with person relation included
    const familyProfiles = familyId
      ? await getProgramProfilesByFamilyId(familyId)
      : profiles.map((p) => ({
          ...p,
          person: person, // Use the parent person we already fetched
        }))

    // Get billing info from first profile's assignment
    const firstProfile = familyProfiles[0]
    const assignments = await getBillingAssignmentsByProfile(firstProfile.id)
    const activeAssignment = assignments.find((a) => a.isActive)
    const subscription = activeAssignment?.subscription

    // Get billing account
    const billingAccount = subscription?.billingAccount

    const students = familyProfiles.map((p) => ({
      id: p.id,
      name: 'person' in p && p.person ? p.person.name : person.name,
    }))

    return {
      success: true,
      data: {
        familyEmail: parentEmail,
        studentCount: familyProfiles.length,
        hasPaymentMethod: billingAccount?.paymentMethodCaptured || false,
        hasSubscription: !!subscription,
        stripeCustomerId: billingAccount?.stripeCustomerIdDugsi || null,
        subscriptionId: subscription?.stripeSubscriptionId || null,
        subscriptionStatus: subscription?.status || null,
        paidUntil: subscription?.paidUntil || null,
        currentPeriodStart: subscription?.currentPeriodStart || null,
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        students,
      },
    }
  } catch (error) {
    console.error('Error getting Dugsi payment status:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get payment status',
    }
  }
}
/**
 * Verify bank account using microdeposit descriptor code.
 * Admins input the 6-digit SM code that families see in their bank statements.
 */
export async function verifyDugsiBankAccount(
  paymentIntentId: string,
  descriptorCode: string
): Promise<ActionResult<BankVerificationData>> {
  try {
    // Validate inputs
    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return {
        success: false,
        error: 'Invalid payment intent ID format. Must start with "pi_"',
      }
    }

    // Validate descriptor code format (6 characters, starts with SM)
    const cleanCode = descriptorCode.trim().toUpperCase()
    if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
      return {
        success: false,
        error:
          'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
      }
    }

    // Call Stripe API to verify microdeposits
    const dugsiStripe = getDugsiStripeClient()

    console.log('🔍 Verifying bank account:', {
      paymentIntentId,
      descriptorCode: cleanCode,
    })

    const paymentIntent = await dugsiStripe.paymentIntents.verifyMicrodeposits(
      paymentIntentId,
      { descriptor_code: cleanCode }
    )

    console.log('✅ Bank account verified successfully:', {
      paymentIntentId,
      status: paymentIntent.status,
    })

    // Revalidate the dashboard to reflect updated payment status
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        paymentIntentId,
        status: paymentIntent.status,
      },
    }
  } catch (error: unknown) {
    console.error('❌ Error verifying bank account:', error)

    // Handle specific Stripe errors
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'StripeInvalidRequestError' &&
      'code' in error
    ) {
      if (error.code === 'payment_intent_unexpected_state') {
        return {
          success: false,
          error: 'This bank account has already been verified',
        }
      }
      if (error.code === 'incorrect_code') {
        return {
          success: false,
          error:
            'Incorrect verification code. Please check the code in the bank statement and try again',
        }
      }
      if (error.code === 'resource_missing') {
        return {
          success: false,
          error: 'Payment intent not found. The verification may have expired',
        }
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to verify bank account',
    }
  }
}

/**
 * Update parent information for entire family.
 * Updates all students in the family with the same parent information.
 *
 * SECURITY: Parent emails (parentEmail and parent2Email) are immutable
 * and cannot be changed via this function. They are used for family
 * identification and security purposes. Changing them would allow
 * hijacking of families, subscriptions, and payment data.
 */
export async function updateParentInfo(params: {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const profile = await getProgramProfileById(params.studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Get family members
    const familyId = profile.familyReferenceId
    if (familyId) {
      // Fetch all family profiles (variable used implicitly for future operations)
      await getProgramProfilesByFamilyId(familyId)
    }

    // Get guardian relationships for the first profile
    const person = profile.person
    const guardianRelationships = person.guardianRelationships || []
    const guardians = guardianRelationships
      .map((rel) => rel.guardian)
      .filter(Boolean)

    // Get the guardian to update (parent1 or parent2)
    const guardianIndex = params.parentNumber - 1
    const guardian = guardians[guardianIndex]

    if (!guardian) {
      return {
        success: false,
        error: `Parent ${params.parentNumber} not found`,
      }
    }

    // Update guardian name
    const fullName = `${params.firstName} ${params.lastName}`.trim()
    await prisma.person.update({
      where: { id: guardian.id },
      data: { name: fullName },
    })

    // Update or create phone contact point
    const existingPhone = guardian.contactPoints?.find(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )

    if (existingPhone) {
      await prisma.contactPoint.update({
        where: { id: existingPhone.id },
        data: { value: params.phone },
      })
    } else {
      await prisma.contactPoint.create({
        data: {
          personId: guardian.id,
          type: 'PHONE',
          value: params.phone,
        },
      })
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: { updated: 1 },
    }
  } catch (error) {
    console.error('Error updating parent info:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update parent info',
    }
  }
}

/**
 * Add a second parent to a family.
 * Only adds if second parent doesn't already exist.
 */
export async function addSecondParent(params: {
  studentId: string
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const profile = await getProgramProfileById(params.studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Check if second parent already exists
    const person = profile.person
    const guardianRelationships = person.guardianRelationships || []
    const guardians = guardianRelationships
      .map((rel) => rel.guardian)
      .filter(Boolean)

    if (guardians.length >= 2) {
      return {
        success: false,
        error: 'Second parent already exists',
      }
    }

    // Check if person with this email already exists
    const existingPerson = await findPersonByContact(params.email, null)
    let parentPersonId: string

    if (existingPerson) {
      parentPersonId = existingPerson.id
    } else {
      // Create new person for second parent
      const fullName = `${params.firstName} ${params.lastName}`.trim()
      const newPerson = await prisma.person.create({
        data: {
          name: fullName,
          contactPoints: {
            create: [
              { type: 'EMAIL', value: params.email.toLowerCase().trim() },
              { type: 'PHONE', value: params.phone },
            ],
          },
        },
      })
      parentPersonId = newPerson.id
    }

    // Create guardian relationship
    await prisma.guardianRelationship.create({
      data: {
        guardianId: parentPersonId,
        dependentId: person.id,
        isActive: true,
      },
    })

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: { updated: 1 },
    }
  } catch (error) {
    console.error('Error adding second parent:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add second parent',
    }
  }
}

/**
 * Update child information for a specific student.
 * Only updates the individual child, not the whole family.
 */
export async function updateChildInfo(params: {
  studentId: string
  firstName?: string
  lastName?: string
  dateOfBirth?: Date
  gender?: 'MALE' | 'FEMALE'
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(params.studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Update person name if provided
    if (params.firstName || params.lastName) {
      const currentName = profile.person.name.split(' ')
      const firstName = params.firstName || currentName[0] || ''
      const lastName = params.lastName || currentName.slice(1).join(' ') || ''
      const fullName = `${firstName} ${lastName}`.trim()

      await prisma.person.update({
        where: { id: profile.personId },
        data: { name: fullName },
      })
    }

    // Update person date of birth if provided
    if (params.dateOfBirth !== undefined) {
      await prisma.person.update({
        where: { id: profile.personId },
        data: { dateOfBirth: params.dateOfBirth },
      })
    }

    // Update program profile fields
    const profileUpdates: Partial<{
      gender: 'MALE' | 'FEMALE'
      educationLevel: EducationLevel
      gradeLevel: GradeLevel
      schoolName: string | null
      healthInfo: string | null
    }> = {}

    if (params.gender !== undefined) profileUpdates.gender = params.gender
    if (params.educationLevel !== undefined)
      profileUpdates.educationLevel = params.educationLevel
    if (params.gradeLevel !== undefined)
      profileUpdates.gradeLevel = params.gradeLevel
    if (params.schoolName !== undefined)
      profileUpdates.schoolName = params.schoolName || null
    if (params.healthInfo !== undefined)
      profileUpdates.healthInfo = params.healthInfo

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.programProfile.update({
        where: { id: params.studentId },
        data: profileUpdates,
      })
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error updating child info:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update child info',
    }
  }
}
/**
 * Add a new child to an existing family.
 * Copies parent information from an existing sibling.
 */
export async function addChildToFamily(params: {
  existingStudentId: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  educationLevel: EducationLevel
  gradeLevel: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult<{ childId: string }>> {
  try {
    const existingProfile = await getProgramProfileById(
      params.existingStudentId
    )
    if (!existingProfile || existingProfile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Existing student not found',
      }
    }

    const familyId = existingProfile.familyReferenceId
    if (!familyId) {
      return {
        success: false,
        error: 'Family reference ID not found',
      }
    }

    // Get guardian relationships from existing profile
    const person = existingProfile.person
    const guardianRelationships = person.guardianRelationships || []
    const guardians = guardianRelationships
      .map((rel) => rel.guardian)
      .filter(Boolean)

    if (guardians.length === 0) {
      return {
        success: false,
        error: 'No guardians found for existing student',
      }
    }

    // Create new person for child
    const fullName = `${params.firstName} ${params.lastName}`.trim()
    const newPerson = await prisma.person.create({
      data: {
        name: fullName,
        dateOfBirth: params.dateOfBirth || null,
      },
    })

    // Create guardian relationships for all guardians
    for (const guardian of guardians) {
      await prisma.guardianRelationship.create({
        data: {
          guardianId: guardian.id,
          dependentId: newPerson.id,
          isActive: true,
        },
      })
    }

    // Create program profile
    const newProfile = await prisma.programProfile.create({
      data: {
        personId: newPerson.id,
        program: 'DUGSI_PROGRAM',
        familyReferenceId: familyId,
        gender: params.gender,
        educationLevel: params.educationLevel,
        gradeLevel: params.gradeLevel,
        schoolName: params.schoolName || null,
        healthInfo: params.healthInfo || null,
        status: 'REGISTERED',
      },
    })

    // Create enrollment
    await prisma.enrollment.create({
      data: {
        programProfileId: newProfile.id,
        status: 'REGISTERED',
        startDate: new Date(),
      },
    })

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: { childId: newProfile.id },
    }
  } catch (error) {
    console.error('Error adding child to family:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to add child to family',
    }
  }
}

/**
 * Update a Dugsi registration (ProgramProfile + Enrollment)
 */
export async function updateDugsiRegistration(
  studentId: string,
  updates: {
    status?: 'REGISTERED' | 'ENROLLED' | 'WITHDRAWN'
    educationLevel?: EducationLevel
    gradeLevel?: GradeLevel
    schoolName?: string
    healthInfo?: string | null
  }
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Update ProgramProfile
    const profileUpdates: Partial<{
      educationLevel: EducationLevel
      gradeLevel: GradeLevel
      schoolName: string | null
      healthInfo: string | null
      status: 'REGISTERED' | 'ENROLLED' | 'WITHDRAWN'
    }> = {}

    if (updates.educationLevel !== undefined)
      profileUpdates.educationLevel = updates.educationLevel
    if (updates.gradeLevel !== undefined)
      profileUpdates.gradeLevel = updates.gradeLevel
    if (updates.schoolName !== undefined)
      profileUpdates.schoolName = updates.schoolName || null
    if (updates.healthInfo !== undefined)
      profileUpdates.healthInfo = updates.healthInfo
    if (updates.status !== undefined) profileUpdates.status = updates.status

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.programProfile.update({
        where: { id: studentId },
        data: profileUpdates,
      })
    }

    // Update Enrollment status if provided
    if (updates.status !== undefined) {
      const activeEnrollment = profile.enrollments?.find(
        (e) => e.status !== 'WITHDRAWN' && !e.endDate
      )
      if (activeEnrollment) {
        await updateEnrollmentStatus(
          activeEnrollment.id,
          updates.status,
          'Updated by admin'
        )
      }
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error updating Dugsi registration:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update registration',
    }
  }
}

/**
 * Delete a Dugsi registration (soft delete via Enrollment.status = 'WITHDRAWN')
 */
export async function deleteDugsiRegistration(
  studentId: string
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Soft delete by withdrawing all enrollments
    const enrollments = profile.enrollments || []
    for (const enrollment of enrollments) {
      if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
        await updateEnrollmentStatus(
          enrollment.id,
          'WITHDRAWN',
          'Deleted by admin'
        )
      }
    }

    // Update profile status
    await prisma.programProfile.update({
      where: { id: studentId },
      data: { status: 'WITHDRAWN' },
    })

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting Dugsi registration:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete registration',
    }
  }
}

/**
 * Generate a payment link for a Dugsi family.
 * Uses the family's familyReferenceId to create a payment URL that can be matched via webhooks.
 *
 * @param studentId - Student ID to fetch family members (if familyMembers not provided)
 * @param familyMembers - Optional: Pre-fetched family members to avoid redundant database query
 */
export async function generatePaymentLink(
  studentId: string,
  familyMembers?: DugsiRegistration[]
): Promise<
  ActionResult<{
    paymentUrl: string
    parentEmail: string
    parentPhone: string | null
    childCount: number
    familyReferenceId: string
  }>
> {
  try {
    // Use provided family members or fetch them
    let members: DugsiRegistration[]
    if (familyMembers && familyMembers.length > 0) {
      members = familyMembers
    } else {
      // Get family members using existing logic
      members = await getFamilyMembers(studentId)
    }

    if (members.length === 0) {
      return { success: false, error: 'Family not found' }
    }

    const firstMember = members[0]

    // Validate parent email exists
    if (!firstMember.parentEmail) {
      return {
        success: false,
        error: 'Parent email is required to generate payment link',
      }
    }

    // Validate email format
    if (!isValidEmail(firstMember.parentEmail)) {
      return {
        success: false,
        error: 'Invalid parent email format',
      }
    }

    if (!firstMember.familyReferenceId) {
      return {
        success: false,
        error: 'Family reference ID not found',
      }
    }

    // Check if payment link config exists
    if (!process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI) {
      return {
        success: false,
        error:
          'Payment link not configured. Please set NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI in environment variables.',
      }
    }

    // Generate payment URL
    const paymentUrl = constructDugsiPaymentUrl({
      parentEmail: firstMember.parentEmail,
      familyId: firstMember.familyReferenceId,
      childCount: members.length,
    })

    return {
      success: true,
      data: {
        paymentUrl,
        parentEmail: firstMember.parentEmail,
        parentPhone: firstMember.parentPhone,
        childCount: members.length,
        familyReferenceId: firstMember.familyReferenceId,
      },
    }
  } catch (error) {
    console.error('Error generating payment link:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate payment link'
    return {
      success: false,
      error: errorMessage,
    }
  }
}
