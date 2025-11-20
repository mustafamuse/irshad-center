import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET() {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json({
    students: [],
    studentsWithSiblings: [],
    studentsWithoutSiblings: [],
    totalStudents: 0,
    totalWithSiblings: 0,
    totalWithoutSiblings: 0,
  })
}

export const dynamic = 'force-dynamic'
