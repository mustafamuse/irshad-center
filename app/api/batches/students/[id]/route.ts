import { NextRequest, NextResponse } from 'next/server'

import { StudentRepository } from '@/app/batches/_repositories/student.repository'
import { StudentService } from '@/app/batches/_services/student.service'

const studentRepository = new StudentRepository()
const studentService = new StudentService(studentRepository)

// GET single student
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await studentService.getStudentById(params.id)

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
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('API: Failed to fetch student:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// PUT update student
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const input = await request.json()
    const result = await studentService.updateStudent(params.id, input)

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
    console.error('API: Failed to update student:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// DELETE student
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await studentService.deleteStudent(params.id)

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
    console.error('API: Failed to delete student:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
