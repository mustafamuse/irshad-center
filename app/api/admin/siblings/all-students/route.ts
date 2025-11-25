import { NextResponse } from 'next/server'

import { getProgramProfiles } from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/admin/siblings/all-students')

export async function GET() {
  try {
    // Get all program profiles
    const { profiles } = await getProgramProfiles({})

    const studentsWithSiblings: string[] = []
    const studentsWithoutSiblings: string[] = []

    // Check each profile for siblings
    for (const profile of profiles) {
      const siblings = await getPersonSiblings(profile.personId)
      if (siblings.length > 0) {
        studentsWithSiblings.push(profile.id)
      } else {
        studentsWithoutSiblings.push(profile.id)
      }
    }

    const students = profiles.map((p) => ({
      id: p.id,
      name: p.person.name,
      program: p.program,
      personId: p.personId,
    }))

    return NextResponse.json({
      students,
      studentsWithSiblings,
      studentsWithoutSiblings,
      totalStudents: students.length,
      totalWithSiblings: studentsWithSiblings.length,
      totalWithoutSiblings: studentsWithoutSiblings.length,
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error fetching all students'
    )
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch students',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
