import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

// Get a single sibling group by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to SiblingRelationship model - Legacy Sibling model removed
  return NextResponse.json(
    { error: 'Migration needed - Legacy Sibling model removed' },
    { status: 501 }
  )
}

// Update a sibling group (add or remove students)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to SiblingRelationship model - Legacy Sibling model removed
  return NextResponse.json(
    { error: 'Migration needed - Legacy Sibling model removed' },
    { status: 501 }
  )
}

// Delete a sibling group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TODO: Migrate to SiblingRelationship model - Legacy Sibling model removed
  return NextResponse.json(
    { error: 'Migration needed - Legacy Sibling model removed' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
