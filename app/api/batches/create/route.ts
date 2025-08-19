import { NextRequest, NextResponse } from 'next/server'

import { BatchRepository } from '@/app/batches/_repositories/batch.repository'
import { BatchService } from '@/app/batches/_services/batch.service'

const batchRepository = new BatchRepository()
const batchService = new BatchService(batchRepository)

export async function POST(request: NextRequest) {
  try {
    const input = await request.json()
    const result = await batchService.createBatch(input)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('API: Failed to create batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
