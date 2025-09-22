import { NextRequest, NextResponse } from 'next/server'
import { createWeekendSession } from '@/lib/queries/attendance'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  classScheduleId: z.string().uuid(),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateSessionSchema.parse(body)

    const session = await createWeekendSession({
      classScheduleId: validatedData.classScheduleId,
      date: new Date(validatedData.date),
      startTime: new Date(validatedData.startTime),
      endTime: new Date(validatedData.endTime),
      notes: validatedData.notes,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}