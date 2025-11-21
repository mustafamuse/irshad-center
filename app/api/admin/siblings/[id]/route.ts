import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import {
  getPersonSiblings,
  removeSiblingRelationship,
  verifySiblingRelationship,
} from '@/lib/db/queries/siblings'

// Get a single sibling group by profile ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get profile to find person ID
    const profile = await getProgramProfileById(id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get siblings for this person
    const siblings = await getPersonSiblings(profile.personId)

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          name: profile.person.name,
          program: profile.program,
        },
        siblings: siblings.map((s) => ({
          person: {
            id: s.person.id,
            name: s.person.name,
          },
          profiles: s.profiles.map((p) => ({
            id: p.id,
            program: p.program,
            status: p.status,
          })),
          relationshipId: s.relationshipId,
          isActive: s.isActive,
        })),
        totalSiblings: siblings.length,
      },
    })
  } catch (error) {
    console.error('Error fetching sibling group:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch sibling group',
      },
      { status: 500 }
    )
  }
}

// Update a sibling relationship (verify, activate/deactivate)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { verifiedBy, notes, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      )
    }

    if (verifiedBy) {
      await verifySiblingRelationship(id, verifiedBy, notes)
    } else if (isActive === false) {
      await removeSiblingRelationship(id)
    } else {
      // Update notes or other fields
      await prisma.siblingRelationship.update({
        where: { id },
        data: {
          notes: notes || undefined,
          isActive: isActive !== undefined ? isActive : true,
        },
      })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error updating sibling relationship:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update sibling relationship',
      },
      { status: 500 }
    )
  }
}

// Delete a sibling relationship (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      )
    }

    await removeSiblingRelationship(id)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting sibling relationship:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete sibling relationship',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
