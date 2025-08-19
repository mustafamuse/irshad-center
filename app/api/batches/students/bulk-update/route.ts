import { NextRequest, NextResponse } from 'next/server'

import { StudentRepository } from '@/app/batches/_repositories/student.repository'
import { StudentService } from '@/app/batches/_services/student.service'

const studentRepository = new StudentRepository()
const studentService = new StudentService(studentRepository)

export async function PUT(request: NextRequest) {
  try {
    const { studentIds, status } = await request.json()

    if (!studentIds || !Array.isArray(studentIds) || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: studentIds (array) and status',
        },
        { status: 400 }
      )
    }

    const result = await studentService.bulkUpdateStatus(studentIds, status)

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
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('API: Failed to bulk update students:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
