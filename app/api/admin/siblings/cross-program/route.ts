import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  getSiblingGroupsByProgram,
  verifySiblingRelationship,
  removeSiblingRelationship,
} from '@/lib/db/queries/siblings'
import { createAPILogger } from '@/lib/logger'
import { createSiblingRelationship } from '@/lib/services/sibling-detector'

const logger = createAPILogger('/api/admin/siblings/cross-program')

/**
 * GET /api/admin/siblings/cross-program
 * List all sibling relationships with full details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const program = searchParams.get('program') || undefined

    const groups = await getSiblingGroupsByProgram(program || undefined)

    // Format response
    const formattedGroups = groups.map((group) => ({
      siblings: group.map((member) => ({
        person: {
          id: member.person.id,
          name: member.person.name,
          dateOfBirth: member.person.dateOfBirth,
        },
        profiles: member.profiles.map((profile) => ({
          id: profile.id,
          program: profile.program,
          status: profile.status,
          enrollments: (profile.enrollments || []).map((enrollment) => ({
            id: enrollment.id,
            status: enrollment.status,
            startDate: enrollment.startDate,
          })),
        })),
      })),
      totalSiblings: group.length,
      programs: Array.from(
        new Set(
          group.flatMap((member) => member.profiles.map((p) => p.program))
        )
      ),
    }))

    return NextResponse.json({
      success: true,
      data: {
        groups: formattedGroups,
        totalGroups: formattedGroups.length,
        discountEligible: formattedGroups.filter(
          (group) => group.totalSiblings >= 2
        ).length,
      },
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to fetch sibling relationships'
    )
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch sibling relationships',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/siblings/cross-program
 * Manually create sibling relationship
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { person1Id, person2Id, notes, verifiedBy } = body

    if (!person1Id || !person2Id) {
      return NextResponse.json(
        { success: false, error: 'person1Id and person2Id are required' },
        { status: 400 }
      )
    }

    if (person1Id === person2Id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot create sibling relationship with self',
        },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const existing = await prisma.siblingRelationship.findFirst({
      where: {
        OR: [
          { person1Id, person2Id },
          { person1Id: person2Id, person2Id: person1Id },
        ],
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sibling relationship already exists',
          data: existing,
        },
        { status: 409 }
      )
    }

    const relationship = await createSiblingRelationship(
      person1Id,
      person2Id,
      'MANUAL',
      {
        confidence: 1.0,
        verifiedBy: verifiedBy || undefined,
        notes: notes || undefined,
      }
    )

    return NextResponse.json({
      success: true,
      data: relationship,
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to create sibling relationship'
    )
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create sibling relationship',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/siblings/cross-program
 * Verify/update sibling relationship
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { relationshipId, verifiedBy, notes, isActive } = body

    if (!relationshipId) {
      return NextResponse.json(
        { success: false, error: 'relationshipId is required' },
        { status: 400 }
      )
    }

    if (verifiedBy) {
      await verifySiblingRelationship(relationshipId, verifiedBy, notes)
    } else if (isActive === false) {
      await removeSiblingRelationship(relationshipId)
    } else {
      // Update notes or other fields
      await prisma.siblingRelationship.update({
        where: { id: relationshipId },
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
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to update sibling relationship'
    )
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update sibling relationship',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/siblings/cross-program
 * Remove sibling relationship
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const relationshipId = searchParams.get('relationshipId')

    if (!relationshipId) {
      return NextResponse.json(
        { success: false, error: 'relationshipId is required' },
        { status: 400 }
      )
    }

    await removeSiblingRelationship(relationshipId)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to delete sibling relationship'
    )
    return NextResponse.json(
      {
        success: false,
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
