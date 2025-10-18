import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get all students with subscription information
    const students = await prisma.student.findMany({
      where: {
        stripeSubscriptionId: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        monthlyRate: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        Batch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform the data to include calculated fields
    const transformedStudents = students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      batchName: student.Batch?.name,
      monthlyAmount: student.monthlyRate,
      status: student.subscriptionStatus,
      stripeSubscriptionId: student.stripeSubscriptionId,
      stripeCustomerId: student.stripeCustomerId,
    }))

    return NextResponse.json({
      Student: transformedStudents,
      summary: {
        total: students.length,
        active: students.filter((s) => s.subscriptionStatus === 'active')
          .length,
        inactive: students.filter(
          (s) => s.subscriptionStatus && s.subscriptionStatus !== 'active'
        ).length,
      },
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
