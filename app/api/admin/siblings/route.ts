import { NextResponse } from 'next/server'

import { getProgramProfiles } from '@/lib/db/queries/program-profile'
import {
  getSiblingGroupsByProgram,
  createSiblingRelationship,
} from '@/lib/db/queries/siblings'

export async function GET() {
  try {
    const groups = await getSiblingGroupsByProgram()

    // Get all profiles to find students without siblings
    const { profiles } = await getProgramProfiles({})
    const profilesWithSiblings = new Set<string>()

    // Collect all person IDs that have siblings
    for (const group of groups) {
      for (const member of group) {
        profilesWithSiblings.add(member.person.id)
      }
    }

    // Find profiles without siblings
    const studentsWithoutSiblings = profiles
      .filter((p) => !profilesWithSiblings.has(p.personId))
      .map((p) => ({
        id: p.id,
        name: p.person.name,
        program: p.program,
      }))

    // Format sibling groups
    const siblingGroups = groups.map((group) => ({
      siblings: group.map((member) => ({
        person: {
          id: member.person.id,
          name: member.person.name,
        },
        profiles: member.profiles.map((p) => ({
          id: p.id,
          program: p.program,
          status: p.status,
        })),
      })),
      totalSiblings: group.length,
    }))

    const totalStudentsWithSiblings = groups.reduce(
      (sum, group) => sum + group.length,
      0
    )

    return NextResponse.json({
      siblingGroups,
      studentsWithoutSiblings,
      totalGroups: groups.length,
      totalStudentsWithSiblings,
      totalStudentsWithoutSiblings: studentsWithoutSiblings.length,
    })
  } catch (error) {
    console.error('Error fetching sibling groups:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch sibling groups',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { person1Id, person2Id, detectionMethod, confidence } = body

    if (!person1Id || !person2Id) {
      return NextResponse.json(
        { error: 'person1Id and person2Id are required' },
        { status: 400 }
      )
    }

    if (person1Id === person2Id) {
      return NextResponse.json(
        { error: 'Cannot create sibling relationship with self' },
        { status: 400 }
      )
    }

    const relationship = await createSiblingRelationship(
      person1Id,
      person2Id,
      detectionMethod || 'manual',
      confidence || null
    )

    return NextResponse.json({
      success: true,
      data: relationship,
    })
  } catch (error) {
    console.error('Error creating sibling relationship:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create sibling relationship',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
