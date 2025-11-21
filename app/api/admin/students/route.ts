import { NextResponse } from 'next/server'

export async function GET() {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json({
    students: [],
    siblingGroupCount: 0,
  })
}

export async function PUT() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
