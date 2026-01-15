import { BatchWithCount } from '@/lib/db/queries/batch'
import { StudentWithBatchData } from '@/lib/db/queries/student'

import { MahadBatch, MahadStudent } from '../_types'

/**
 * Maps database student data to MahadStudent type
 */
export function mapStudent(s: StudentWithBatchData): MahadStudent {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone ?? null,
    dateOfBirth: s.dateOfBirth ?? null,
    gradeLevel: s.gradeLevel ?? null,
    schoolName: s.schoolName ?? null,
    graduationStatus: s.graduationStatus ?? null,
    paymentFrequency: s.paymentFrequency ?? null,
    billingType: s.billingType ?? null,
    paymentNotes: s.paymentNotes ?? null,
    status: s.status,
    batchId: s.batchId ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    batch: s.batch
      ? {
          id: s.batch.id,
          name: s.batch.name,
          startDate: s.batch.startDate,
          endDate: s.batch.endDate,
        }
      : null,
    subscription: s.subscription
      ? {
          id: s.subscription.id,
          status: s.subscription.status,
          stripeSubscriptionId: s.subscription.stripeSubscriptionId,
          amount: s.subscription.amount,
        }
      : null,
    siblingCount: s.siblingCount,
  }
}

/**
 * Maps database batch data to MahadBatch type
 */
export function mapBatch(b: BatchWithCount): MahadBatch {
  return {
    id: b.id,
    name: b.name,
    startDate: b.startDate,
    endDate: b.endDate,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    studentCount: b.studentCount,
  }
}
