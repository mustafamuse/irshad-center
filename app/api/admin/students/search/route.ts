import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const excludeIds = searchParams.getAll('exclude') || []

    // If no query is provided, return all students
    if (!query.trim()) {
      const students = await prisma.student.findMany({
        where: {
          id: {
            notIn: excludeIds.length > 0 ? excludeIds : undefined,
          },
        },
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
        take: 100, // Limit to 100 students for performance
      })

      return NextResponse.json({
        students,
        total: students.length,
        query,
      })
    }

    // Search for students by name, email, or phone
    const students = await prisma.student.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: query,
            },
          },
        ],
        id: {
          notIn: excludeIds.length > 0 ? excludeIds : undefined,
        },
      },
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

    return NextResponse.json({
      students,
      total: students.length,
      query,
    })
  } catch (error) {
    console.error('Failed to search Student:', error)
    return NextResponse.json(
      { error: 'Failed to search students' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
