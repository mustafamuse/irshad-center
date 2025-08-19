import { NextRequest, NextResponse } from 'next/server'

import { StudentRepository } from '@/app/batches/_repositories/student.repository'
import { StudentService } from '@/app/batches/_services/student.service'

const studentRepository = new StudentRepository()
const studentService = new StudentService(studentRepository)

// GET duplicate students
export async function GET() {
  try {
    const result = await studentService.getDuplicateStudents()

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API: Failed to get duplicate students:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// POST resolve duplicates
export async function POST(request: NextRequest) {
  try {
    const { keepId, deleteIds, mergeData = false } = await request.json()

    if (!keepId || !deleteIds || !Array.isArray(deleteIds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: keepId and deleteIds (array)',
        },
        { status: 400 }
      )
    }

    const result = await studentService.resolveDuplicates(
      keepId,
      deleteIds,
      mergeData
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('API: Failed to resolve duplicates:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
