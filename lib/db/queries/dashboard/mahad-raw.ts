/**
 * Raw SQL Dashboard Query for Mahad
 *
 * Single optimized query that fetches all Mahad student data.
 * Uses raw SQL for maximum performance - replaces Prisma ORM queries.
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
  SubscriptionStatus,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { StudentStatus } from '@/lib/types/student'

import { StudentWithBatchData } from '../student'

interface MahadDashboardRawRow {
  id: string
  person_name: string
  person_email: string | null
  person_phone: string | null
  person_date_of_birth: Date | null
  grade_level: GradeLevel | null
  school_name: string | null
  graduation_status: GraduationStatus | null
  payment_frequency: PaymentFrequency | null
  billing_type: StudentBillingType | null
  payment_notes: string | null
  enrollment_status: string | null
  batch_id: string | null
  batch_name: string | null
  batch_start_date: Date | null
  batch_end_date: Date | null
  subscription_id: string | null
  subscription_status: SubscriptionStatus | null
  subscription_amount: number | null
  stripe_subscription_id: string | null
  created_at: Date
  updated_at: Date
}

export async function getMahadDashboardRaw(): Promise<StudentWithBatchData[]> {
  const rows = await prisma.$queryRaw<MahadDashboardRawRow[]>`
    SELECT
      pp.id,
      p.name as person_name,
      (SELECT cp.value FROM "ContactPoint" cp
       WHERE cp."personId" = p.id AND cp.type = 'EMAIL' AND cp."isActive" = true
       LIMIT 1) as person_email,
      (SELECT cp.value FROM "ContactPoint" cp
       WHERE cp."personId" = p.id AND cp.type IN ('PHONE', 'WHATSAPP') AND cp."isActive" = true
       LIMIT 1) as person_phone,
      p."dateOfBirth" as person_date_of_birth,
      pp."gradeLevel" as grade_level,
      pp."schoolName" as school_name,
      pp."graduationStatus" as graduation_status,
      pp."paymentFrequency" as payment_frequency,
      pp."billingType" as billing_type,
      pp."paymentNotes" as payment_notes,
      e.status as enrollment_status,
      e."batchId" as batch_id,
      b.name as batch_name,
      b."startDate" as batch_start_date,
      b."endDate" as batch_end_date,
      s.id as subscription_id,
      s.status as subscription_status,
      s.amount as subscription_amount,
      s."stripeSubscriptionId" as stripe_subscription_id,
      pp."createdAt" as created_at,
      pp."updatedAt" as updated_at
    FROM "ProgramProfile" pp
    JOIN "Person" p ON p.id = pp."personId"
    LEFT JOIN LATERAL (
      SELECT * FROM "Enrollment" e2
      WHERE e2."programProfileId" = pp.id AND e2.status != 'WITHDRAWN' AND e2."endDate" IS NULL
      ORDER BY e2."startDate" DESC LIMIT 1
    ) e ON true
    LEFT JOIN "Batch" b ON b.id = e."batchId"
    LEFT JOIN "BillingAssignment" ba ON ba."programProfileId" = pp.id AND ba."isActive" = true
    LEFT JOIN "Subscription" s ON s.id = ba."subscriptionId"
    WHERE pp.program = 'MAHAD_PROGRAM'
      AND EXISTS (
        SELECT 1 FROM "Enrollment" e3
        WHERE e3."programProfileId" = pp.id
          AND e3.status != 'WITHDRAWN'
          AND e3."endDate" IS NULL
      )
    ORDER BY pp."createdAt" DESC
  `

  return rows.map(mapRawToStudentWithBatchData)
}

function enrollmentStatusToStudentStatus(
  enrollmentStatus: string | null
): StudentStatus {
  if (!enrollmentStatus) return StudentStatus.REGISTERED

  const mapping: Record<string, StudentStatus> = {
    REGISTERED: StudentStatus.REGISTERED,
    ENROLLED: StudentStatus.ENROLLED,
    ON_LEAVE: StudentStatus.ON_LEAVE,
    WITHDRAWN: StudentStatus.WITHDRAWN,
    COMPLETED: StudentStatus.WITHDRAWN,
    SUSPENDED: StudentStatus.WITHDRAWN,
  }
  return mapping[enrollmentStatus] ?? StudentStatus.REGISTERED
}

function mapRawToStudentWithBatchData(
  row: MahadDashboardRawRow
): StudentWithBatchData {
  return {
    id: row.id,
    name: row.person_name,
    email: row.person_email,
    phone: row.person_phone,
    dateOfBirth: row.person_date_of_birth,
    gradeLevel: row.grade_level,
    schoolName: row.school_name,
    graduationStatus: row.graduation_status,
    paymentFrequency: row.payment_frequency,
    billingType: row.billing_type,
    paymentNotes: row.payment_notes,
    status: enrollmentStatusToStudentStatus(row.enrollment_status),
    batchId: row.batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    batch: row.batch_id
      ? {
          id: row.batch_id,
          name: row.batch_name!,
          startDate: row.batch_start_date,
          endDate: row.batch_end_date,
        }
      : null,
    subscription: row.subscription_id
      ? {
          id: row.subscription_id,
          status: row.subscription_status!,
          stripeSubscriptionId: row.stripe_subscription_id!,
          amount: row.subscription_amount!,
        }
      : null,
  }
}
