import { NextResponse } from 'next/server'

import { BatchRepository } from '@/app/batches/_repositories/batch.repository'
import { BatchService } from '@/app/batches/_services/batch.service'

const batchRepository = new BatchRepository()
const batchService = new BatchService(batchRepository)

export async function GET() {
  try {
    const result = await batchService.getAllBatches()

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
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API: Failed to fetch batches:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
