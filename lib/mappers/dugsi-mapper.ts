/**
 * Dugsi Mappers
 *
 * Pure data transformation functions for Dugsi program.
 * These functions transform database entities to DTOs (Data Transfer Objects).
 *
 * Rules:
 * - No database calls
 * - No business logic
 * - Pure functions only
 * - Type-safe inputs (no `any`)
 */

import { SubscriptionStatus, StripeAccountType } from '@prisma/client'

import { DugsiRegistration } from '@/app/admin/dugsi/_types'
import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import {
  ProgramProfileWithGuardians,
  ProgramProfileFull,
} from '@/lib/db/prisma-helpers'

/**
 * Maps a ProgramProfile with full relations to a DugsiRegistration DTO.
 *
 * This is a pure data transformation - no database calls, no business logic.
 *
 * @param profile - ProgramProfile with guardians, enrollments, and billing data
 * @returns DugsiRegistration DTO for UI display
 */
export function mapProfileToDugsiRegistration(
  profile: ProgramProfileFull
): DugsiRegistration | null {
  // Validate program type
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    return null
  }

  const person = profile.person

  // Extract guardian relationships (child is the dependent, guardians are parents)
  const dependentRelationships = person.dependentRelationships || []
  const guardians = dependentRelationships
    .map((rel) => rel.guardian)
    .filter(Boolean)

  // Primary parent (first guardian)
  const parent1 = guardians[0]
  const parent1Email = parent1?.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )?.value
  const parent1Phone = parent1?.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )?.value
  const parent1Name = parent1?.name
  const parent1NameParts = parent1Name ? parent1Name.split(' ') : []
  const parent1FirstName = parent1NameParts[0] || null
  const parent1LastName = parent1NameParts.slice(1).join(' ') || null

  // Second parent (second guardian)
  const parent2 = guardians[1]
  const parent2Email = parent2?.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )?.value
  const parent2Phone = parent2?.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )?.value
  const parent2Name = parent2?.name
  const parent2NameParts = parent2Name ? parent2Name.split(' ') : []
  const parent2FirstName = parent2NameParts[0] || null
  const parent2LastName = parent2NameParts.slice(1).join(' ') || null

  // Determine which parent is the primary payer
  const primaryPayerIndex = dependentRelationships.findIndex(
    (rel) => rel.isPrimaryPayer
  )
  const primaryPayerParentNumber: 1 | 2 | null =
    primaryPayerIndex === 0 ? 1 : primaryPayerIndex === 1 ? 2 : null

  // Extract billing information from active assignment
  const activeAssignment = profile.assignments?.[0]
  const subscription = activeAssignment?.subscription
  const billingAccount = subscription?.billingAccount

  return {
    id: profile.id,
    name: person.name,
    gender: profile.gender,
    dateOfBirth: person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    healthInfo: profile.healthInfo,
    createdAt: profile.createdAt,

    // Parent 1 info
    parentFirstName: parent1FirstName ?? null,
    parentLastName: parent1LastName ?? null,
    parentEmail: parent1Email ?? null,
    parentPhone: parent1Phone ?? null,

    // Parent 2 info
    parent2FirstName: parent2FirstName ?? null,
    parent2LastName: parent2LastName ?? null,
    parent2Email: parent2Email ?? null,
    parent2Phone: parent2Phone ?? null,

    // Primary payer designation
    primaryPayerParentNumber,

    // Billing info
    paymentMethodCaptured: billingAccount?.paymentMethodCaptured ?? false,
    paymentMethodCapturedAt: billingAccount?.paymentMethodCapturedAt ?? null,
    stripeCustomerIdDugsi: billingAccount?.stripeCustomerIdDugsi ?? null,
    stripeSubscriptionIdDugsi: subscription?.stripeSubscriptionId ?? null,
    paymentIntentIdDugsi: billingAccount?.paymentIntentIdDugsi ?? null,
    subscriptionStatus: (subscription?.status as SubscriptionStatus) ?? null,
    subscriptionAmount: subscription?.amount ?? null,
    paidUntil: subscription?.paidUntil ?? null,
    currentPeriodStart: subscription?.currentPeriodStart ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,

    // Family tracking
    familyReferenceId: profile.familyReferenceId,
    stripeAccountType:
      (billingAccount?.accountType as StripeAccountType) ?? null,
  }
}

/**
 * Maps a simplified ProgramProfile (with guardians only) to DugsiRegistration.
 *
 * Use this when you don't need full billing/enrollment data.
 *
 * @param profile - ProgramProfile with guardians
 * @returns Partial DugsiRegistration (without billing info)
 */
export function mapProfileToSimpleDugsiRegistration(
  profile: ProgramProfileWithGuardians
): Omit<
  DugsiRegistration,
  | 'paymentMethodCaptured'
  | 'paymentMethodCapturedAt'
  | 'stripeCustomerIdDugsi'
  | 'stripeSubscriptionIdDugsi'
  | 'paymentIntentIdDugsi'
  | 'subscriptionStatus'
  | 'subscriptionAmount'
  | 'paidUntil'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'stripeAccountType'
> {
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new Error('Invalid profile: must be DUGSI_PROGRAM')
  }

  const person = profile.person
  const dependentRelationships = person.dependentRelationships || []
  const guardians = dependentRelationships
    .map((rel) => rel.guardian)
    .filter(Boolean)

  // Primary parent
  const parent1 = guardians[0]
  const parent1Email = parent1?.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )?.value
  const parent1Phone = parent1?.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )?.value
  const parent1Name = parent1?.name
  const parent1NameParts = parent1Name ? parent1Name.split(' ') : []
  const parent1FirstName = parent1NameParts[0] || null
  const parent1LastName = parent1NameParts.slice(1).join(' ') || null

  // Second parent
  const parent2 = guardians[1]
  const parent2Email = parent2?.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )?.value
  const parent2Phone = parent2?.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )?.value
  const parent2Name = parent2?.name
  const parent2NameParts = parent2Name ? parent2Name.split(' ') : []
  const parent2FirstName = parent2NameParts[0] || null
  const parent2LastName = parent2NameParts.slice(1).join(' ') || null

  // Determine which parent is the primary payer
  const primaryPayerIndex = dependentRelationships.findIndex(
    (rel) => rel.isPrimaryPayer
  )
  const primaryPayerParentNumber: 1 | 2 | null =
    primaryPayerIndex === 0 ? 1 : primaryPayerIndex === 1 ? 2 : null

  return {
    id: profile.id,
    name: person.name,
    gender: profile.gender,
    dateOfBirth: person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    healthInfo: profile.healthInfo,
    createdAt: profile.createdAt,

    parentFirstName: parent1FirstName ?? null,
    parentLastName: parent1LastName ?? null,
    parentEmail: parent1Email ?? null,
    parentPhone: parent1Phone ?? null,

    parent2FirstName: parent2FirstName ?? null,
    parent2LastName: parent2LastName ?? null,
    parent2Email: parent2Email ?? null,
    parent2Phone: parent2Phone ?? null,

    primaryPayerParentNumber,

    familyReferenceId: profile.familyReferenceId,
  }
}

/**
 * Helper to extract parent email from a profile.
 * Used for delete previews and other operations that need just the parent contact.
 */
export function extractParentEmail(
  profile: ProgramProfileWithGuardians
): string | null {
  const guardian = profile.person.dependentRelationships?.[0]?.guardian
  return (
    guardian?.contactPoints?.find((cp) => cp.type === 'EMAIL')?.value ?? null
  )
}
