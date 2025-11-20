import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

// Get a single student by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

// Update a student
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

// Delete a student
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json(
    { error: 'Migration needed - Student model removed' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
