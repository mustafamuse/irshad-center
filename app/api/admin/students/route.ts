import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get all students with their sibling group information
    const students = await prisma.student.findMany({
      select: {
        id: true,
        name: true,
        siblingGroupId: true,
        Sibling: {
          include: {
            Student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Get count of sibling groups
    const siblingGroupCount = await prisma.sibling.count()

    return NextResponse.json({
      students,
      siblingGroupCount,
    })
  } catch (error) {
    console.error('Failed to fetch Student:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}

export async function PUT() {
  try {
    // First, try to find the Irshād 4 batch
    let batch = await prisma.batch.findFirst({
      where: {
        name: 'Irshād 4',
      },
    })

    // If it doesn't exist, create it
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          name: 'Irshād 4',
        },
      })
    }

    // Update all students to be part of this batch
    await prisma.student.updateMany({
      data: {
        batchId: batch.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'All students updated to Irshād 4 batch',
      batchId: batch.id,
    })
  } catch (error) {
    console.error('Failed to update students Batch:', error)
    return NextResponse.json(
      { error: 'Failed to update students batch' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
