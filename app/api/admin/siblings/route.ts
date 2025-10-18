import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get all sibling groups with their students
    const siblingGroups = await prisma.sibling.findMany({
      include: {
        Student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            batchId: true,
            Batch: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Get all students without a sibling group
    const studentsWithoutSiblings = await prisma.student.findMany({
      where: {
        siblingGroupId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        batchId: true,
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

    // Format the response
    const formattedGroups = siblingGroups.map((group) => ({
      id: group.id,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      Student: group.Student,
      studentCount: group.Student.length,
    }))

    return NextResponse.json({
      siblingGroups: formattedGroups,
      studentsWithoutSiblings,
      totalGroups: formattedGroups.length,
      totalStudentsWithSiblings: formattedGroups.reduce(
        (acc, group) => acc + group.Student.length,
        0
      ),
      totalStudentsWithoutSiblings: studentsWithoutSiblings.length,
    })
  } catch (error) {
    console.error('Failed to fetch sibling groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sibling groups' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentIds } = body

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length < 2) {
      return NextResponse.json(
        { error: 'At least two student IDs are required' },
        { status: 400 }
      )
    }

    // Create a new sibling group
    const siblingGroup = await prisma.sibling.create({
      data: {
        Student: {
          connect: studentIds.map((id) => ({ id })),
        },
      },
      include: {
        Student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      siblingGroup,
    })
  } catch (error) {
    console.error('Failed to create sibling group:', error)
    return NextResponse.json(
      { error: 'Failed to create sibling group' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
