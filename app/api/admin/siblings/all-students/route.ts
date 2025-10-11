import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get all students
    const students = await prisma.student.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        batchId: true,
        siblingGroupId: true,
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

    // Group students by whether they have a sibling group
    const studentsWithSiblings = students.filter(
      (student) => student.siblingGroupId
    )
    const studentsWithoutSiblings = students.filter(
      (student) => !student.siblingGroupId
    )

    return NextResponse.json({
      students,
      studentsWithSiblings,
      studentsWithoutSiblings,
      totalStudents: students.length,
      totalWithSiblings: studentsWithSiblings.length,
      totalWithoutSiblings: studentsWithoutSiblings.length,
    })
  } catch (error) {
    console.error('Failed to fetch all Student:', error)
    return NextResponse.json(
      { error: 'Failed to fetch all students' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
