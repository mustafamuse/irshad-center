import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const backup = await request.json()

    // Start transaction to ensure all-or-nothing restore
    await prisma.$transaction(async (tx) => {
      // Clear existing data (optional, based on your needs)
      await tx.studentPayment.deleteMany({})
      await tx.student.deleteMany({})
      await tx.sibling.deleteMany({})
      await tx.batch.deleteMany({})

      // Restore in correct order (handle relationships)
      // 1. First, create batches (no dependencies)
      if (backup.data.batches) {
        await tx.batch.createMany({
          data: backup.data.batches.map(
            ({ id, name, startDate, endDate }: any) => ({
              id,
              name,
              startDate: startDate ? new Date(startDate) : null,
              endDate: endDate ? new Date(endDate) : null,
            })
          ),
        })
      }

      // 2. Create sibling groups
      if (backup.data.siblings) {
        await tx.sibling.createMany({
          data: backup.data.siblings.map(({ id }: any) => ({ id })),
        })
      }

      // 3. Create students (with relationships)
      if (backup.data.students) {
        await tx.student.createMany({
          data: backup.data.Student.map((student: any) => ({
            id: student.id,
            name: student.name,
            email: student.email,
            phone: student.phone,
            dateOfBirth: student.dateOfBirth
              ? new Date(student.dateOfBirth)
              : null,
            educationLevel: student.educationLevel,
            gradeLevel: student.gradeLevel,
            schoolName: student.schoolName,
            highSchoolGraduated: student.highSchoolGraduated,
            highSchoolGradYear: student.highSchoolGradYear,
            collegeGraduated: student.collegeGraduated,
            collegeGradYear: student.collegeGradYear,
            postGradCompleted: student.postGradCompleted,
            postGradYear: student.postGradYear,
            batchId: student.batchId,
            monthlyRate: student.monthlyRate,
            customRate: student.customRate,
            status: student.status,
            siblingGroupId: student.siblingGroupId,
            stripeCustomerId: student.stripeCustomerId,
            stripeSubscriptionId: student.stripeSubscriptionId,
            subscriptionStatus: student.subscriptionStatus,
            lastPaymentDate: student.lastPaymentDate
              ? new Date(student.lastPaymentDate)
              : null,
            nextPaymentDue: student.nextPaymentDue
              ? new Date(student.nextPaymentDue)
              : null,
            paidUntil: student.paidUntil ? new Date(student.paidUntil) : null,
          })),
        })
      }

      // 4. Restore student payments if they exist
      if (backup.data.studentPayments) {
        await tx.studentPayment.createMany({
          data: backup.data.studentPayments.map((payment: any) => ({
            id: payment.id,
            studentId: payment.studentId,
            stripeInvoiceId: payment.stripeInvoiceId,
            year: payment.year,
            month: payment.month,
            amountPaid: payment.amountPaid,
            paidAt: new Date(payment.paidAt),
          })),
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully',
    })
  } catch (error) {
    console.error('Restore failed:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to restore database',
      },
      { status: 500 }
    )
  }
}
