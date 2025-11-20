import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  // TODO: Migrate to SiblingRelationship model - Legacy Sibling model removed
  return NextResponse.json({
    siblingGroups: [],
    studentsWithoutSiblings: [],
    totalGroups: 0,
    totalStudentsWithSiblings: 0,
    totalStudentsWithoutSiblings: 0,
  })
}

export async function POST(request: Request) {
  // TODO: Migrate to SiblingRelationship model - Legacy Sibling model removed
  return NextResponse.json(
    { error: 'Migration needed - Legacy Sibling model removed' },
    { status: 501 }
  )
}

export const dynamic = 'force-dynamic'
