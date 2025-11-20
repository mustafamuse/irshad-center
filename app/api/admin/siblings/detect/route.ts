import { NextRequest, NextResponse } from 'next/server'

import { detectPotentialSiblings } from '@/lib/services/sibling-detector'

/**
 * POST /api/admin/siblings/detect
 * Run detection algorithms for a specific person
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId } = body

    if (!personId) {
      return NextResponse.json(
        { success: false, error: 'personId is required' },
        { status: 400 }
      )
    }

    const potentialSiblings = await detectPotentialSiblings(personId)

    return NextResponse.json({
      success: true,
      data: {
        potentialSiblings: potentialSiblings.map((ps) => ({
          person: {
            id: ps.person.id,
            name: ps.person.name,
            dateOfBirth: ps.person.dateOfBirth,
          },
          method: ps.method,
          confidence: ps.confidence,
          reasons: ps.reasons,
        })),
        totalFound: potentialSiblings.length,
      },
    })
  } catch (error) {
    console.error('Failed to detect potential siblings:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to detect potential siblings',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/siblings/detect
 * Get all unverified potential siblings for review
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const personId = searchParams.get('personId')

    if (!personId) {
      return NextResponse.json(
        { success: false, error: 'personId is required' },
        { status: 400 }
      )
    }

    const potentialSiblings = await detectPotentialSiblings(personId)

    // Filter to only unverified relationships
    const unverified = potentialSiblings.filter((ps) => ps.confidence < 0.9)

    return NextResponse.json({
      success: true,
      data: {
        potentialSiblings: unverified.map((ps) => ({
          person: {
            id: ps.person.id,
            name: ps.person.name,
            dateOfBirth: ps.person.dateOfBirth,
          },
          method: ps.method,
          confidence: ps.confidence,
          reasons: ps.reasons,
        })),
        totalFound: unverified.length,
      },
    })
  } catch (error) {
    console.error('Failed to get unverified siblings:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get unverified siblings',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

