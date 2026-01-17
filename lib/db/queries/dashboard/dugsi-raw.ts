/**
 * Raw SQL Dashboard Query for Dugsi
 *
 * Single optimized query that fetches all Dugsi registration data.
 * Uses raw SQL for maximum performance - replaces Prisma ORM queries.
 */

import {
  Prisma,
  Shift,
  Gender,
  GradeLevel,
  SubscriptionStatus,
  StripeAccountType,
} from '@prisma/client'

import { DugsiRegistration } from '@/app/admin/dugsi/_types'
import { prisma } from '@/lib/db'

interface DugsiDashboardRawRow {
  id: string
  person_name: string
  person_date_of_birth: Date | null
  gender: Gender | null
  grade_level: GradeLevel | null
  shift: Shift | null
  school_name: string | null
  health_info: string | null
  family_reference_id: string | null
  created_at: Date
  parent1_name: string | null
  parent1_email: string | null
  parent1_phone: string | null
  parent1_is_primary_payer: boolean | null
  parent2_name: string | null
  parent2_email: string | null
  parent2_phone: string | null
  parent2_is_primary_payer: boolean | null
  subscription_id: string | null
  subscription_status: SubscriptionStatus | null
  subscription_amount: number | null
  paid_until: Date | null
  current_period_start: Date | null
  current_period_end: Date | null
  payment_method_captured: boolean | null
  payment_method_captured_at: Date | null
  stripe_customer_id_dugsi: string | null
  payment_intent_id_dugsi: string | null
  account_type: StripeAccountType | null
  family_child_count: number
}

export async function getDugsiDashboardRaw(filters?: {
  shift?: Shift
}): Promise<DugsiRegistration[]> {
  const shiftFilter = filters?.shift
    ? Prisma.sql`AND pp.shift = ${filters.shift}::"Shift"`
    : Prisma.empty

  const rows = await prisma.$queryRaw<DugsiDashboardRawRow[]>`
    WITH family_counts AS (
      SELECT "familyReferenceId", COUNT(*)::int as child_count
      FROM "ProgramProfile"
      WHERE program = 'DUGSI_PROGRAM' AND status IN ('REGISTERED', 'ENROLLED')
        AND "familyReferenceId" IS NOT NULL
      GROUP BY "familyReferenceId"
    ),
    parent_info AS (
      SELECT
        gr."dependentId",
        ROW_NUMBER() OVER (PARTITION BY gr."dependentId" ORDER BY gr."createdAt") as parent_num,
        g.name as parent_name,
        gr."isPrimaryPayer",
        (SELECT cp.value FROM "ContactPoint" cp
         WHERE cp."personId" = g.id AND cp.type = 'EMAIL' AND cp."isActive" = true
         LIMIT 1) as parent_email,
        (SELECT cp.value FROM "ContactPoint" cp
         WHERE cp."personId" = g.id AND cp.type IN ('PHONE', 'WHATSAPP') AND cp."isActive" = true
         LIMIT 1) as parent_phone
      FROM "GuardianRelationship" gr
      JOIN "Person" g ON g.id = gr."guardianId"
      WHERE gr."isActive" = true
    )
    SELECT
      pp.id,
      p.name as person_name,
      p."dateOfBirth" as person_date_of_birth,
      pp.gender,
      pp."gradeLevel" as grade_level,
      pp.shift,
      pp."schoolName" as school_name,
      pp."healthInfo" as health_info,
      pp."familyReferenceId" as family_reference_id,
      pp."createdAt" as created_at,
      p1.parent_name as parent1_name,
      p1.parent_email as parent1_email,
      p1.parent_phone as parent1_phone,
      p1."isPrimaryPayer" as parent1_is_primary_payer,
      p2.parent_name as parent2_name,
      p2.parent_email as parent2_email,
      p2.parent_phone as parent2_phone,
      p2."isPrimaryPayer" as parent2_is_primary_payer,
      s."stripeSubscriptionId" as subscription_id,
      s.status as subscription_status,
      s.amount as subscription_amount,
      s."paidUntil" as paid_until,
      s."currentPeriodStart" as current_period_start,
      s."currentPeriodEnd" as current_period_end,
      ba."paymentMethodCaptured" as payment_method_captured,
      ba."paymentMethodCapturedAt" as payment_method_captured_at,
      ba."stripeCustomerIdDugsi" as stripe_customer_id_dugsi,
      ba."paymentIntentIdDugsi" as payment_intent_id_dugsi,
      ba."accountType" as account_type,
      COALESCE(fc.child_count, 1)::int as family_child_count
    FROM "ProgramProfile" pp
    JOIN "Person" p ON p.id = pp."personId"
    LEFT JOIN parent_info p1 ON p1."dependentId" = p.id AND p1.parent_num = 1
    LEFT JOIN parent_info p2 ON p2."dependentId" = p.id AND p2.parent_num = 2
    LEFT JOIN "BillingAssignment" ba_active ON ba_active."programProfileId" = pp.id AND ba_active."isActive" = true
    LEFT JOIN "Subscription" s ON s.id = ba_active."subscriptionId"
    LEFT JOIN "BillingAccount" ba ON ba.id = s."billingAccountId"
    LEFT JOIN family_counts fc ON fc."familyReferenceId" = pp."familyReferenceId"
    WHERE pp.program = 'DUGSI_PROGRAM'
    ${shiftFilter}
    ORDER BY pp."createdAt" DESC
  `

  return rows.map(mapRawToDugsiRegistration)
}

function splitName(fullName: string | null): {
  first: string | null
  last: string | null
} {
  if (!fullName) return { first: null, last: null }
  const parts = fullName.split(' ')
  return {
    first: parts[0] || null,
    last: parts.slice(1).join(' ') || null,
  }
}

function mapRawToDugsiRegistration(
  row: DugsiDashboardRawRow
): DugsiRegistration {
  const parent1Name = splitName(row.parent1_name)
  const parent2Name = splitName(row.parent2_name)

  let primaryPayerParentNumber: 1 | 2 | null = null
  if (row.parent1_is_primary_payer) {
    primaryPayerParentNumber = 1
  } else if (row.parent2_is_primary_payer) {
    primaryPayerParentNumber = 2
  }

  return {
    id: row.id,
    name: row.person_name,
    gender: row.gender,
    dateOfBirth: row.person_date_of_birth,
    gradeLevel: row.grade_level,
    shift: row.shift,
    schoolName: row.school_name,
    healthInfo: row.health_info,
    createdAt: row.created_at,

    parentFirstName: parent1Name.first,
    parentLastName: parent1Name.last,
    parentEmail: row.parent1_email,
    parentPhone: row.parent1_phone,

    parent2FirstName: parent2Name.first,
    parent2LastName: parent2Name.last,
    parent2Email: row.parent2_email,
    parent2Phone: row.parent2_phone,

    primaryPayerParentNumber,

    paymentMethodCaptured: row.payment_method_captured ?? false,
    paymentMethodCapturedAt: row.payment_method_captured_at,
    stripeCustomerIdDugsi: row.stripe_customer_id_dugsi,
    stripeSubscriptionIdDugsi: row.subscription_id,
    paymentIntentIdDugsi: row.payment_intent_id_dugsi,
    subscriptionStatus: row.subscription_status,
    subscriptionAmount: row.subscription_amount,
    paidUntil: row.paid_until,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,

    familyReferenceId: row.family_reference_id,
    stripeAccountType: row.account_type,

    teacherName: null,
    teacherEmail: null,
    teacherPhone: null,
    morningTeacher: null,
    afternoonTeacher: null,
    hasTeacherAssigned: false,

    familyChildCount: row.family_child_count,
  }
}
