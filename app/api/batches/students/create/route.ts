import { NextRequest, NextResponse } from 'next/server'

import { StudentRepository } from '@/app/batches/_repositories/student.repository'
import { StudentService } from '@/app/batches/_services/student.service'

const studentRepository = new StudentRepository()
const studentService = new StudentService(studentRepository)

export async function POST(request: NextRequest) {
  try {
    const input = await request.json()
    const result = await studentService.createStudent(input)

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
    console.error('API: Failed to create student:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
