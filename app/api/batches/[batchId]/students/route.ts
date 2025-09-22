import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params

    console.log('Fetching students for batch:', batchId)
    const students = await prisma.student.findMany({
      where: {
        batchId,
        status: 'registered', // Only get registered students
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    console.log('Found students:', students.length)
    return NextResponse.json({
      success: true,
      data: students,
    })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch students',
      },
      { status: 500 }
    )
  }
}
