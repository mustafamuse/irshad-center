import { NextResponse } from 'next/server'

import { StudentRepository } from '@/app/batches/_repositories/student.repository'
import { StudentService } from '@/app/batches/_services/student.service'

const studentRepository = new StudentRepository()
const studentService = new StudentService(studentRepository)

export async function GET() {
  try {
    const result = await studentService.getAllStudents()

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
    console.error('API: Failed to fetch students:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
