import { NextResponse } from 'next/server'

// Get a single student by ID
export async function GET(
  _request: Request,
  _props: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

// Update a student
export async function PATCH(
  _request: Request,
  _props: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

// Delete a student
export async function DELETE(
  _request: Request,
  _props: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
