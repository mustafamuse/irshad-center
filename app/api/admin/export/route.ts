import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Fetch all data we want to export
    const [students, batches, siblings] = await Promise.all([
      prisma.student.findMany({
        include: {
          Sibling: true,
        },
      }),
      prisma.batch.findMany(),
      prisma.sibling.findMany({
        include: {
          Student: {
            select: {
              name: true, // Use name instead of ID for matching
            },
          },
        },
      }),
    ])

    // Create a seed data object with essential data only
    const seedData = {
      batches: batches.map((batch) => ({
        name: batch.name,
        startDate: batch.startDate?.toISOString() || null,
        endDate: batch.endDate?.toISOString() || null,
      })),
      Student: students.map((student) => ({
        name: student.name,
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth?.toISOString() || null,
        educationLevel: student.educationLevel,
        gradeLevel: student.gradeLevel,
        schoolName: student.schoolName,
        highSchoolGraduated: student.highSchoolGraduated,
        collegeGraduated: student.collegeGraduated,
        postGradCompleted: student.postGradCompleted,
        monthlyRate: student.monthlyRate,
        customRate: student.customRate,
        status: student.status,
        batchName: batches.find((b) => b.id === student.batchId)?.name || null,
      })),
      siblingGroups: siblings.map((sibling) => ({
        studentNames: sibling.Student.map((s) => s.name),
      })),
    }

    // Set headers for file download
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set(
      'Content-Disposition',
      `attachment; filename=seed-data-${new Date().toISOString().split('T')[0]}.json`
    )

    return new NextResponse(JSON.stringify(seedData, null, 2), {
      headers,
    })
  } catch (error) {
    console.error('Failed to export data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
